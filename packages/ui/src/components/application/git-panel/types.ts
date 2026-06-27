/**
 * Source Control types + small shared constants.
 *
 * Pure module (no runes / Svelte) so the store, the pure helpers, and the
 * markup components can all import it. The host-facing types (`GitProvider`,
 * `GitChange`, …) are re-exported from `git-panel.svelte` to keep the public
 * `@glyphx/ui/application` surface unchanged.
 */

export type GitChange = { path: string; status: string; staged: boolean };
export type GitCommitEntry = {
  hash: string;
  summary: string;
  author: string;
  time: number;
};
export type GitHeadInfo = {
  branch: string | null;
  unborn: boolean;
  /** Upstream tracking branch (e.g. `origin/main`), if configured. */
  upstream?: string | null;
  /** Commits ahead of the remote (undefined / null when not applicable). */
  ahead?: number | null;
  /** Commits behind the remote. */
  behind?: number | null;
  /** True while a merge is in progress (working tree may have conflicts). */
  merging?: boolean;
};

export type GitRemote = { name: string; url: string };

/** Host-injected Git backend (desktop = Tauri / gitoxide). */
export type GitProvider = {
  /** Whether a usable system `git` is installed — gates the remote half (push/pull/sync). */
  available?: () => Promise<boolean>;
  isRepo: (root: string) => Promise<boolean>;
  init: (root: string) => Promise<void>;
  head: (root: string) => Promise<GitHeadInfo>;
  status: (root: string) => Promise<GitChange[]>;
  /** Stage paths into the index (`git add`). */
  stage: (root: string, paths: string[]) => Promise<void>;
  /** Unstage paths (`git reset <path>`). */
  unstage: (root: string, paths: string[]) => Promise<void>;
  /** Discard working-tree changes (`git restore`); deletes untracked files. */
  discard: (root: string, paths: string[]) => Promise<void>;
  /** Unified diff for a path; `staged` = HEAD↔index vs index↔worktree. */
  diff: (root: string, path: string, staged: boolean) => Promise<string>;
  /** Both sides of a change as full text, for the side-by-side / inline diff editor. */
  fileVersions: (
    root: string,
    path: string,
    staged: boolean,
  ) => Promise<{ original: string; modified: string; binary: boolean }>;
  /** Commit the staged index; returns the short hash. */
  commit: (root: string, message: string) => Promise<string>;
  log: (root: string, limit?: number) => Promise<GitCommitEntry[]>;
  /** Clone `url` into `dest`; returns the working-tree path. */
  clone: (url: string, dest: string) => Promise<string>;
  /** Configured remotes (name + fetch URL). */
  remotes: (root: string) => Promise<GitRemote[]>;
  /** Add a remote (`git remote add`). */
  remoteAdd: (root: string, name: string, url: string) => Promise<void>;
  /** Change a remote's URL (`git remote set-url`). */
  remoteSetUrl: (root: string, name: string, url: string) => Promise<void>;
  /** Rename a remote (`git remote rename`). */
  remoteRename: (root: string, from: string, to: string) => Promise<void>;
  /** Remove a remote (`git remote remove`). */
  remoteRemove: (root: string, name: string) => Promise<void>;
  /** Fetch tracking refs (optionally from an authenticated `url`). */
  fetch: (root: string, url?: string) => Promise<void>;
  /** Fast-forward pull (system git); `url` carries token auth. */
  pull: (root: string, url?: string) => Promise<string>;
  /** Push current branch (system git); `url` carries token auth, `remote` names the tracking ref to refresh. */
  push: (
    root: string,
    url?: string,
    branch?: string,
    remote?: string,
  ) => Promise<string>;
  /** Sync = pull (merge) then push; reports merge conflicts instead of throwing. */
  sync: (
    root: string,
    url?: string,
    branch?: string,
    remote?: string,
  ) => Promise<{ conflicts: boolean; message: string }>;
  /** Native confirmation dialog (desktop wires Tauri's); falls back to window.confirm. */
  confirm?: (message: string, title?: string) => Promise<boolean>;
};

/** Collapsible top-level sections (like the Explorer's Files / Outline). */
export type SectionKey = "staged" | "changes" | "remotes" | "history";

/** What the smart primary button does once the tree is clean. */
export type SyncAction = "push" | "pull" | "sync" | "none";

export type TreeNode = {
  /** Display segment — a folder may be a compressed chain like `src/lib`. */
  name: string;
  /** Folder path (for collapse) or full file path. */
  path: string;
  isFile: boolean;
  change?: GitChange;
  children: TreeNode[];
};

/** Plain-language description of a failed remote operation. */
export type GitErrorInfo = { title: string; message: string; details?: string };

export const STATUS_LABEL: Record<string, string> = {
  modified: "M",
  deleted: "D",
  untracked: "U",
  added: "A",
  renamed: "R",
  conflicted: "!",
};
export const STATUS_CLASS: Record<string, string> = {
  modified: "text-warning",
  deleted: "text-destructive",
  untracked: "text-success",
  added: "text-success",
  renamed: "text-brand",
  conflicted: "text-destructive",
};

export const INPUT_CLS =
  "border-border bg-background focus:ring-brand/40 w-full rounded border px-2 py-1 text-xs outline-none focus:ring-2";
