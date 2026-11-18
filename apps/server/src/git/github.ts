import { bearer, type Change, check, type Fetcher, type GitProvider } from "./provider.ts";

const API = "https://api.github.com";
const HEADERS = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };

export function githubProvider(fetcher: Fetcher): GitProvider {
	const api = async (token: string, path: string, init: RequestInit = {}) =>
		check(
			await fetcher(`${API}${path}`, {
				...init,
				headers: { ...HEADERS, ...bearer(token), ...(init.headers as object) }
			}),
			"GitHub"
		);
	const json = async <T>(token: string, path: string, init?: RequestInit) =>
		(await api(token, path, init)).json() as Promise<T>;
	const send = (method: string, body: unknown): RequestInit => ({
		method,
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body)
	});
	const enc = (path: string) => path.split("/").map(encodeURIComponent).join("/");

	return {
		name: "github",
		async repos(token, query) {
			const rows = await json<{ full_name: string; default_branch: string; private: boolean }[]>(
				token,
				"/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member"
			);
			const q = query?.toLowerCase();
			return rows
				.filter((r) => !q || r.full_name.toLowerCase().includes(q))
				.slice(0, 50)
				.map((r) => ({
					fullName: r.full_name,
					defaultBranch: r.default_branch,
					private: r.private
				}));
		},
		async branches(token, repo) {
			const rows = await json<{ name: string }[]>(token, `/repos/${repo}/branches?per_page=100`);
			return rows.map((r) => r.name);
		},
		async tree(token, repo, branch) {
			const head = await json<{ sha: string; commit: { tree: { sha: string } } }>(
				token,
				`/repos/${repo}/branches/${encodeURIComponent(branch)}`
			);
			const tree = await json<{
				truncated: boolean;
				tree: { path: string; type: string; size?: number }[];
			}>(token, `/repos/${repo}/git/trees/${head.commit.tree.sha}?recursive=1`);
			if (tree.truncated) throw new Error("This repository is too large to sync.");
			return {
				commit: head.sha,
				files: tree.tree
					.filter((e) => e.type === "blob")
					.map((e) => ({ path: e.path, size: e.size }))
			};
		},
		async readFile(token, repo, path, commit) {
			const res = await api(token, `/repos/${repo}/contents/${enc(path)}?ref=${commit}`, {
				headers: { accept: "application/vnd.github.raw+json" }
			});
			return res.text();
		},
		async commit(token, repo, input) {
			const parent = await json<{ tree: { sha: string } }>(
				token,
				`/repos/${repo}/git/commits/${input.parent}`
			);
			const entries = await Promise.all(
				input.changes.map(async (c: Change) => {
					if (c.content === null) {
						return { path: c.path, mode: "100644", type: "blob", sha: null as string | null };
					}
					const blob = await json<{ sha: string }>(
						token,
						`/repos/${repo}/git/blobs`,
						send("POST", { content: c.content, encoding: "utf-8" })
					);
					return { path: c.path, mode: "100644", type: "blob", sha: blob.sha as string | null };
				})
			);
			const tree = await json<{ sha: string }>(
				token,
				`/repos/${repo}/git/trees`,
				send("POST", { base_tree: parent.tree.sha, tree: entries })
			);
			const created = await json<{ sha: string }>(
				token,
				`/repos/${repo}/git/commits`,
				send("POST", { message: input.message, tree: tree.sha, parents: [input.parent] })
			);
			if (input.newBranch) {
				await api(
					token,
					`/repos/${repo}/git/refs`,
					send("POST", { ref: `refs/heads/${input.branch}`, sha: created.sha })
				);
			} else {
				await api(
					token,
					`/repos/${repo}/git/refs/heads/${encodeURIComponent(input.branch)}`,
					send("PATCH", { sha: created.sha })
				);
			}
			return { commit: created.sha };
		},
		async pullRequest(token, repo, input) {
			const pr = await json<{ html_url: string }>(
				token,
				`/repos/${repo}/pulls`,
				send("POST", { title: input.title, head: input.head, base: input.base, body: input.body })
			);
			return { url: pr.html_url };
		}
	};
}
