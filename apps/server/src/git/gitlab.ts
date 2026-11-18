import { bearer, check, type Fetcher, type GitProvider } from "./provider.ts";

const MAX_PAGES = 20;

export function gitlabProvider(baseUrl: string, fetcher: Fetcher): GitProvider {
	const api = async (token: string, path: string, init: RequestInit = {}) =>
		check(
			await fetcher(`${baseUrl}/api/v4${path}`, {
				...init,
				headers: { ...bearer(token), ...(init.headers as object) }
			}),
			"GitLab"
		);
	const json = async <T>(token: string, path: string, init?: RequestInit) =>
		(await api(token, path, init)).json() as Promise<T>;
	const send = (body: unknown): RequestInit => ({
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body)
	});
	const id = (repo: string) => encodeURIComponent(repo);

	return {
		name: "gitlab",
		async repos(t, query) {
			const rows = await json<
				{ path_with_namespace: string; default_branch: string | null; visibility: string }[]
			>(
				t,
				`/projects?membership=true&per_page=50&order_by=last_activity_at${
					query ? `&search=${encodeURIComponent(query)}` : ""
				}`
			);
			return rows.map((r) => ({
				fullName: r.path_with_namespace,
				defaultBranch: r.default_branch ?? "main",
				private: r.visibility !== "public"
			}));
		},
		async branches(t, repo) {
			const rows = await json<{ name: string }[]>(
				t,
				`/projects/${id(repo)}/repository/branches?per_page=100`
			);
			return rows.map((r) => r.name);
		},
		async tree(t, repo, branch) {
			const head = await json<{ commit: { id: string } }>(
				t,
				`/projects/${id(repo)}/repository/branches/${encodeURIComponent(branch)}`
			);
			const files: { path: string }[] = [];
			for (let page = 1; page <= MAX_PAGES; page++) {
				const rows = await json<{ type: string; path: string }[]>(
					t,
					`/projects/${id(repo)}/repository/tree?ref=${head.commit.id}&recursive=true&per_page=100&page=${page}`
				);
				files.push(...rows.filter((r) => r.type === "blob"));
				if (rows.length < 100) return { commit: head.commit.id, files };
			}
			throw new Error("This repository is too large to sync.");
		},
		async readFile(t, repo, path, commit) {
			const res = await api(
				t,
				`/projects/${id(repo)}/repository/files/${encodeURIComponent(path)}/raw?ref=${commit}`
			);
			return res.text();
		},
		async commit(t, repo, input) {
			const created = await json<{ id: string }>(
				t,
				`/projects/${id(repo)}/repository/commits`,
				send({
					branch: input.branch,
					...(input.newBranch && { start_sha: input.parent }),
					commit_message: input.message,
					actions: input.changes.map((c) =>
						c.content === null
							? { action: "delete", file_path: c.path }
							: {
									action: input.existing.has(c.path) ? "update" : "create",
									file_path: c.path,
									content: c.content
								}
					)
				})
			);
			return { commit: created.id };
		},
		async pullRequest(t, repo, input) {
			const mr = await json<{ web_url: string }>(
				t,
				`/projects/${id(repo)}/merge_requests`,
				send({
					source_branch: input.head,
					target_branch: input.base,
					title: input.title,
					description: input.body
				})
			);
			return { url: mr.web_url };
		}
	};
}
