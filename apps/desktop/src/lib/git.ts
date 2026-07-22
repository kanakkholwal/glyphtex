import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import type { GitProvider } from '@glyphtex/ui/application';

/**
 * Desktop Git provider — local version control via the Rust `git` module
 * (gitoxide). Operates on the open project folder; local ops are pure Rust, while
 * push / pull / remote edits shell out to the system `git`.
 */
export const gitProvider: GitProvider = {
	available: () => invoke('git_available'),
	isRepo: (root) => invoke('git_is_repo', { root }),
	init: (root) => invoke('git_init', { root }),
	head: (root) => invoke('git_head', { root }),
	status: (root) => invoke('git_status', { root }),
	stage: (root, paths) => invoke('git_stage', { root, paths }),
	unstage: (root, paths) => invoke('git_unstage', { root, paths }),
	discard: (root, paths) => invoke('git_discard', { root, paths }),
	diff: (root, path, staged) => invoke('git_diff', { root, path, staged }),
	fileVersions: (root, path, staged) => invoke('git_file_versions', { root, path, staged }),
	commit: (root, message) => invoke('git_commit', { root, message }),
	log: (root, limit) => invoke('git_log', { root, limit }),
	clone: (url, dest) => invoke('git_clone', { url, dest }),
	remotes: (root) => invoke('git_remotes', { root }),
	remoteAdd: (root, name, url) => invoke('git_remote_add', { root, name, url }),
	remoteSetUrl: (root, name, url) => invoke('git_remote_set_url', { root, name, url }),
	remoteRename: (root, from, to) => invoke('git_remote_rename', { root, from, to }),
	remoteRemove: (root, name) => invoke('git_remote_remove', { root, name }),
	fetch: (root, url) => invoke('git_fetch', { root, url }),
	pull: (root, url) => invoke('git_pull', { root, url }),
	push: (root, url, branch, remote) => invoke('git_push', { root, url, branch, remote }),
	sync: (root, url, branch, remote) => invoke('git_sync', { root, url, branch, remote }),
	// Native OS confirmation dialog (Tauri) for destructive actions.
	confirm: (message, title) => confirm(message, { title, kind: 'warning' })
};
