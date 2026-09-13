import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import type { GitProvider } from "@glyphtex/ui/application";

// Called inside async methods, so the throw surfaces as a rejected promise.
/** Rejects values system git would read as an option, and the `ext::` transport, which runs commands. */
function arg(value: string, what: string): string {
	if (value.trimStart().startsWith("-") || /^\s*ext::/i.test(value)) {
		throw new Error(`That ${what} isn't valid: it can't start with "-" or "ext::".`);
	}
	return value;
}

/**
 * Desktop Git provider over the Rust `git` module. Local ops are pure-Rust gix;
 * push, pull and remote edits shell out to system `git`.
 */
export const gitProvider: GitProvider = {
	available: () => invoke("git_available"),
	isRepo: (root) => invoke("git_is_repo", { root }),
	init: (root) => invoke("git_init", { root }),
	head: (root) => invoke("git_head", { root }),
	status: (root) => invoke("git_status", { root }),
	stage: (root, paths) => invoke("git_stage", { root, paths }),
	unstage: (root, paths) => invoke("git_unstage", { root, paths }),
	discard: (root, paths) => invoke("git_discard", { root, paths }),
	diff: (root, path, staged) => invoke("git_diff", { root, path, staged }),
	fileVersions: (root, path, staged) => invoke("git_file_versions", { root, path, staged }),
	commit: (root, message) => invoke("git_commit", { root, message }),
	log: (root, limit) => invoke("git_log", { root, limit }),
	clone: async (url, dest) => invoke("git_clone", { url: arg(url, "URL"), dest }),
	remotes: (root) => invoke("git_remotes", { root }),
	remoteAdd: async (root, name, url) =>
		invoke("git_remote_add", { root, name: arg(name, "remote name"), url: arg(url, "URL") }),
	remoteSetUrl: async (root, name, url) =>
		invoke("git_remote_set_url", { root, name: arg(name, "remote name"), url: arg(url, "URL") }),
	remoteRename: async (root, from, to) =>
		invoke("git_remote_rename", {
			root,
			from: arg(from, "remote name"),
			to: arg(to, "remote name")
		}),
	remoteRemove: async (root, name) =>
		invoke("git_remote_remove", { root, name: arg(name, "remote name") }),
	fetch: async (root, url) => invoke("git_fetch", { root, url: url && arg(url, "URL") }),
	pull: async (root, url) => invoke("git_pull", { root, url: url && arg(url, "URL") }),
	push: async (root, url, branch, remote) =>
		invoke("git_push", {
			root,
			url: url && arg(url, "URL"),
			branch: branch && arg(branch, "branch"),
			remote: remote && arg(remote, "remote name")
		}),
	sync: async (root, url, branch, remote) =>
		invoke("git_sync", {
			root,
			url: url && arg(url, "URL"),
			branch: branch && arg(branch, "branch"),
			remote: remote && arg(remote, "remote name")
		}),
	// Native OS confirmation dialog (Tauri) for destructive actions.
	confirm: (message, title) => confirm(message, { title, kind: "warning" })
};
