import { bearer, check, type Fetcher, type GitProvider } from "./provider.ts";

const API = "https://api.bitbucket.org/2.0";
const MAX_PAGES = 20;

export function bitbucketProvider(fetcher: Fetcher): GitProvider {
	const api = async (token: string, url: string, init: RequestInit = {}) =>
		check(
			await fetcher(url.startsWith("http") ? url : `${API}${url}`, {
				...init,
				headers: { ...bearer(token), ...(init.headers as object) }
			}),
			"Bitbucket"
		);
	const json = async <T>(token: string, url: string, init?: RequestInit) =>
		(await api(token, url, init)).json() as Promise<T>;
	const send = (body: unknown): RequestInit => ({
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body)
	});
	const enc = (path: string) => path.split("/").map(encodeURIComponent).join("/");

	return {
		name: "bitbucket",
		async repos(t, query) {
			const q = query ? `&q=${encodeURIComponent(`name ~ "${query.replace(/"/g, "")}"`)}` : "";
			const page = await json<{
				values: { full_name: string; mainbranch?: { name: string }; is_private: boolean }[];
			}>(t, `/repositories?role=member&pagelen=50&sort=-updated_on${q}`);
			return page.values.map((r) => ({
				fullName: r.full_name,
				defaultBranch: r.mainbranch?.name ?? "main",
				private: r.is_private
			}));
		},
		async branches(t, repo) {
			const page = await json<{ values: { name: string }[] }>(
				t,
				`/repositories/${repo}/refs/branches?pagelen=100`
			);
			return page.values.map((r) => r.name);
		},
		async tree(t, repo, branch) {
			const head = await json<{ target: { hash: string } }>(
				t,
				`/repositories/${repo}/refs/branches/${encodeURIComponent(branch)}`
			);
			const files: { path: string; size?: number }[] = [];
			let next: string | undefined =
				`/repositories/${repo}/src/${head.target.hash}/?pagelen=100&max_depth=10`;
			for (let i = 0; next && i < MAX_PAGES; i++) {
				const page: { values: { type: string; path: string; size?: number }[]; next?: string } =
					await json(t, next);
				files.push(...page.values.filter((v) => v.type === "commit_file"));
				next = page.next;
			}
			if (next) throw new Error("This repository is too large to sync.");
			return { commit: head.target.hash, files };
		},
		async readFile(t, repo, path, commit) {
			return (await api(t, `/repositories/${repo}/src/${commit}/${enc(path)}`)).text();
		},
		async commit(t, repo, input) {
			const form = new URLSearchParams({
				message: input.message,
				branch: input.branch,
				parents: input.parent
			});
			for (const c of input.changes) {
				if (c.content === null) form.append("files", c.path);
				else form.append(c.path, c.content);
			}
			await api(t, `/repositories/${repo}/src`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: form
			});
			const head = await json<{ target: { hash: string } }>(
				t,
				`/repositories/${repo}/refs/branches/${encodeURIComponent(input.branch)}`
			);
			return { commit: head.target.hash };
		},
		async pullRequest(t, repo, input) {
			const pr = await json<{ links: { html: { href: string } } }>(
				t,
				`/repositories/${repo}/pullrequests`,
				send({
					title: input.title,
					description: input.body,
					source: { branch: { name: input.head } },
					destination: { branch: { name: input.base } }
				})
			);
			return { url: pr.links.html.href };
		}
	};
}
