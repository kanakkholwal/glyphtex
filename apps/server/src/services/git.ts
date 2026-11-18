import { eq } from "drizzle-orm";
import type { Deps } from "../context.ts";
import { type GitProviderName, projectGitLink } from "../db/schema.ts";
import { gitProviders } from "../git/index.ts";
import { type Fetcher, type GitProvider, hostName } from "../git/provider.ts";
import { sha256Hex } from "../lib/crypto.ts";
import { errors } from "../lib/errors.ts";
import { isTextPath, normalizePath } from "../lib/paths.ts";
import type { ProjectAccess } from "../rbac/authorize.ts";
import { planPull, planPush } from "../git/plan.ts";
import { fileRepository } from "../repositories/files.ts";
import { fileService } from "./files.ts";

const encoder = new TextEncoder();

export interface PullResult {
	pulled: number;
	/** Files changed on both sides since the last sync; left untouched. */
	conflicts: string[];
	/** Remote files that are not text (images, PDFs), which stay in the repository only. */
	skipped: number;
}

/**
 * Decision (architecture): OAuth, account linking, token storage and refresh are Better Auth's.
 * A host connects as a linked account (`linkSocial` or generic OAuth `oauth2.link`), and we only
 * ask it for a fresh access token for the caller. This service does repository work with it.
 */
export function gitService(deps: Deps, fetcher?: Fetcher) {
	const { db, config, auth } = deps;
	const providers = gitProviders(config, fetcher);

	function provider(name: GitProviderName): GitProvider {
		const found = providers[name];
		if (!found) throw errors.notFound(`${hostName(name)} connection`);
		return found;
	}

	/** The caller's own token for a host, refreshed by Better Auth when it expired. */
	async function tokenFor(headers: Headers, name: GitProviderName): Promise<string> {
		const accounts = await auth.api.listUserAccounts({ headers });
		const account = accounts.find((a) => a.providerId === name);
		if (!account) {
			throw errors.conflict(`Connect your ${hostName(name)} account first.`, {
				code: "git_not_connected"
			});
		}
		try {
			const { accessToken } = await auth.api.getAccessToken({
				headers,
				body: { accountId: account.id }
			});
			return accessToken;
		} catch {
			throw errors.conflict(`Reconnect your ${hostName(name)} account: its access expired.`, {
				code: "git_reconnect"
			});
		}
	}

	async function linkOf(projectId: string) {
		const [row] = await db
			.select()
			.from(projectGitLink)
			.where(eq(projectGitLink.projectId, projectId));
		if (!row) throw errors.notFound("Git link");
		return row;
	}

	return {
		async repos(headers: Headers, name: GitProviderName, query?: string) {
			return provider(name).repos(await tokenFor(headers, name), query);
		},

		async branches(headers: Headers, name: GitProviderName, repo: string) {
			return provider(name).branches(await tokenFor(headers, name), repo);
		},

		async getLink({ project }: ProjectAccess) {
			const [row] = await db
				.select({
					provider: projectGitLink.provider,
					repo: projectGitLink.repo,
					branch: projectGitLink.branch,
					lastCommit: projectGitLink.lastCommit,
					lastSyncedAt: projectGitLink.lastSyncedAt
				})
				.from(projectGitLink)
				.where(eq(projectGitLink.projectId, project.id));
			return row ?? null;
		},

		async link(
			{ project }: ProjectAccess,
			userId: string,
			headers: Headers,
			input: { provider: GitProviderName; repo: string; branch: string }
		) {
			const p = provider(input.provider);
			const token = await tokenFor(headers, input.provider);
			const branches = await p.branches(token, input.repo);
			if (!branches.includes(input.branch)) {
				throw errors.badRequest(`The branch "${input.branch}" doesn't exist in ${input.repo}.`);
			}
			const values = {
				provider: input.provider,
				repo: input.repo,
				branch: input.branch,
				lastCommit: null,
				base: {},
				linkedBy: userId,
				lastSyncedAt: null
			};
			await db
				.insert(projectGitLink)
				.values({ projectId: project.id, ...values })
				.onConflictDoUpdate({ target: projectGitLink.projectId, set: values });
		},

		async unlink({ project }: ProjectAccess) {
			await db.delete(projectGitLink).where(eq(projectGitLink.projectId, project.id));
		},

		/**
		 * Brings the repository's text files into the project. A file changed on both sides since the
		 * last sync is reported, not overwritten.
		 */
		async pull(access: ProjectAccess, userId: string, headers: Headers): Promise<PullResult> {
			const link = await linkOf(access.project.id);
			const p = provider(link.provider);
			const token = await tokenFor(headers, link.provider);
			const tree = await p.tree(token, link.repo, link.branch);
			const { limits } = config;
			const textFiles = tree.files.filter((f) => isTextPath(f.path));
			if (textFiles.length > limits.filesPerProject) {
				throw errors.tooLarge(`The repository has more than ${limits.filesPerProject} text files.`);
			}
			const repo = fileRepository(db);
			const files = fileService(deps);
			const base: Record<string, string> = { ...link.base };
			const conflicts: string[] = [];
			let pulled = 0;
			for (const remote of textFiles) {
				if ((remote.size ?? 0) > limits.textFileBytes) continue;
				const path = normalizePath(remote.path);
				const content = await p.readFile(token, link.repo, remote.path, tree.commit);
				const bytes = encoder.encode(content);
				const remoteSha = await sha256Hex(bytes);
				const local = await repo.get(access.project.id, path);
				const action = planPull({
					remoteSha,
					local: local ? { sha: local.sha256, isText: local.kind === "text" } : undefined,
					baseSha: base[path]
				});
				if (action === "same") base[path] = remoteSha;
				if (action === "conflict") conflicts.push(path);
				if (action !== "write") continue;
				await files.write(
					access,
					userId,
					path,
					bytes,
					"text/plain",
					local ? { version: local.version } : { create: true }
				);
				base[path] = remoteSha;
				pulled++;
			}
			await db
				.update(projectGitLink)
				.set({ base, lastCommit: tree.commit, lastSyncedAt: new Date() })
				.where(eq(projectGitLink.projectId, access.project.id));
			return { pulled, conflicts, skipped: tree.files.length - textFiles.length };
		},

		/**
		 * Sends the project's text changes to the repository as one commit, either on the linked
		 * branch or on a new branch with a pull request. Refuses if the branch moved since the pull.
		 */
		async push(
			access: ProjectAccess,
			userId: string,
			headers: Headers,
			input: { message: string; mode: "commit" | "pr" }
		): Promise<{ commit: string; pushed: number; pullRequestUrl?: string }> {
			const link = await linkOf(access.project.id);
			const p = provider(link.provider);
			const token = await tokenFor(headers, link.provider);
			const tree = await p.tree(token, link.repo, link.branch);
			if (!link.lastCommit) {
				throw errors.conflict(
					"Pull from the repository once before pushing, so we know what changed."
				);
			}
			if (tree.commit !== link.lastCommit) {
				throw errors.conflict(
					`The branch "${link.branch}" has new commits. Pull them first, then push again.`
				);
			}
			const local = (await fileRepository(db).listWithText(access.project.id)).filter(
				(f) => f.kind === "text" && f.content !== null
			);
			const existing = new Set(tree.files.map((f) => f.path));
			const plan = planPush({
				local: local.map((f) => ({ path: f.path, sha: f.sha256 })),
				base: link.base,
				remotePaths: existing
			});
			const contentOf = new Map(local.map((f) => [f.path, f]));
			const changes: { path: string; content: string | null }[] = [
				...plan.upserts.map((path) => ({ path, content: contentOf.get(path)?.content ?? "" })),
				...plan.deletes.map((path) => ({ path, content: null }))
			];
			const nextBase: Record<string, string> = { ...link.base };
			for (const path of plan.upserts) nextBase[path] = contentOf.get(path)?.sha256 ?? "";
			for (const path of plan.deletes) delete nextBase[path];
			if (changes.length === 0) return { commit: tree.commit, pushed: 0 };
			const message = input.message.trim().slice(0, 500) || "Update from GlyphTeX";
			if (input.mode === "pr") {
				const branch = `glyphtex/${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}`;
				const done = await p.commit(token, link.repo, {
					branch,
					parent: tree.commit,
					message,
					changes,
					newBranch: true,
					existing
				});
				const pr = await p.pullRequest(token, link.repo, {
					head: branch,
					base: link.branch,
					title: message.split("\n")[0] as string,
					body: "Changes from GlyphTeX."
				});
				// The base stays put: these changes are not on the linked branch until the PR is merged.
				return { commit: done.commit, pushed: changes.length, pullRequestUrl: pr.url };
			}
			const done = await p.commit(token, link.repo, {
				branch: link.branch,
				parent: tree.commit,
				message,
				changes,
				existing
			});
			await db
				.update(projectGitLink)
				.set({ base: nextBase, lastCommit: done.commit, lastSyncedAt: new Date() })
				.where(eq(projectGitLink.projectId, access.project.id));
			return { commit: done.commit, pushed: changes.length };
		}
	};
}

export type GitService = ReturnType<typeof gitService>;
