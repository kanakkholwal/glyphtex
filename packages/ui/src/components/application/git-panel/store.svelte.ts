import { describeError } from "./errors";
import { buildTree } from "./tree";
import type {
  GitChange,
  GitCommitEntry,
  GitErrorInfo,
  GitHeadInfo,
  GitProvider,
  GitRemote,
  SectionKey,
  SyncAction,
} from "./types";

export type GitPanelDeps = {
  git?: GitProvider;
  getRoot: () => string | null | undefined;
  /** Open a file's diff in the editor pane (host wires this to the diff view). */
  onopendiff?: (path: string, staged: boolean) => void;
};

/** All Source Control state and behaviour. Like the workbench stores it holds no
 *  `$effect` — the component drives refresh and detection from its own. */
export class GitPanelStore {
  readonly #git?: GitProvider;
  readonly #getRoot: () => string | null | undefined;
  readonly #onopendiff?: (path: string, staged: boolean) => void;

  isRepo = $state(false);
  head = $state<GitHeadInfo | undefined>(undefined);
  changes = $state<GitChange[]>([]);
  commits = $state<GitCommitEntry[]>([]);
  message = $state("");

  loading = $state(false);
  busy = $state(false);
  error = $state<string | undefined>(undefined);

  // Remotes
  remotes = $state<GitRemote[]>([]);
  token = $state("");
  showToken = $state(false);
  remoteMsg = $state<string | undefined>(undefined);
  // The remote half (push/pull/sync/remote edits) shells out to the system git.
  // Detect it up front so those actions explain themselves instead of failing.
  gitMissing = $state(false);
  // Which remote fetch/pull/push act on; falls back to origin / first.
  selectedRemote = $state("");

  // Inline remote editing / adding (no custom dialog — native confirm for removal).
  editingRemote = $state<string | null>(null);
  editName = $state("");
  editUrl = $state("");
  addingRemote = $state(false);
  newRemoteName = $state("origin");
  newRemoteUrl = $state("");

  // Changes view: which folders are collapsed (tree mode).
  collapsed = $state(new Set<string>());

  sections = $state<Record<SectionKey, boolean>>({
    staged: true,
    changes: true,
    remotes: true,
    history: true,
  });

  // Remote errors: shown in a friendly UI dialog (not inline / not native).
  gitError = $state<GitErrorInfo | undefined>(undefined);
  showErrorDetails = $state(false);

  constructor(deps: GitPanelDeps) {
    this.#git = deps.git;
    this.#getRoot = deps.getRoot;
    this.#onopendiff = deps.onopendiff;
  }

  // --- Derived views --------------------------------------------------------
  readonly activeRemote = $derived(
    this.remotes.find((r) => r.name === this.selectedRemote) ??
      this.remotes.find((r) => r.name === "origin") ??
      this.remotes[0],
  );
  readonly hasRemote = $derived(this.remotes.length > 0);

  readonly staged = $derived(this.changes.filter((c) => c.staged));
  readonly unstaged = $derived(this.changes.filter((c) => !c.staged));
  readonly stagedTree = $derived(buildTree(this.staged));
  readonly unstagedTree = $derived(buildTree(this.unstaged));

  // Unresolved merge conflicts block committing until they're resolved + staged.
  readonly hasConflicts = $derived(
    this.changes.some((c) => c.status === "conflicted"),
  );
  readonly canCommit = $derived(
    this.isRepo &&
      !this.busy &&
      !this.hasConflicts &&
      this.staged.length > 0 &&
      // During a merge an empty message is fine (we fill a default).
      (this.message.trim().length > 0 || !!this.head?.merging),
  );

  readonly hasChanges = $derived(
    this.staged.length > 0 || this.unstaged.length > 0,
  );
  // Smart primary action (VS Code-style): commit while there are changes; once
  // the tree is clean, become Push / Pull / Sync if local & remote differ.
  readonly syncAction = $derived<SyncAction>(
    this.head?.ahead && this.head?.behind
      ? "sync"
      : this.head?.ahead
        ? "push"
        : this.head?.behind
          ? "pull"
          : "none",
  );

  // --- Helpers --------------------------------------------------------------
  /** Clicking a changed file opens its diff in the editor pane (VS Code-style). */
  showDiff(c: GitChange): void {
    this.#onopendiff?.(c.path, c.staged);
  }

  toggleFolder(path: string): void {
    const next = new Set(this.collapsed);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    this.collapsed = next;
  }

  toggleSection(key: SectionKey): void {
    this.sections[key] = !this.sections[key];
  }

  /** The active remote's URL with the access token injected for HTTPS auth. */
  #authedUrl(): string | undefined {
    const base = this.activeRemote?.url;
    if (!base) return undefined;
    const t = this.token.trim();
    if (!t) return base;
    try {
      const u = new URL(base);
      u.username = "x-access-token";
      u.password = t;
      return u.toString();
    } catch {
      return base;
    }
  }

  /** Native OS confirm (desktop) with a window.confirm fallback (web). */
  async #askConfirm(msg: string): Promise<boolean> {
    if (this.#git?.confirm) return this.#git.confirm(msg, "GlyphTeX");
    return typeof window !== "undefined" ? window.confirm(msg) : true;
  }

  // --- Data loading / detection (driven by the component's effects) ---------
  async refresh(): Promise<void> {
    const git = this.#git;
    const root = this.#getRoot();
    if (!git || !root) return;
    this.loading = true;
    this.error = undefined;
    try {
      this.isRepo = await git.isRepo(root);
      if (!this.isRepo) {
        this.changes = [];
        this.commits = [];
        this.head = undefined;
        return;
      }
      const [head, changes, commits] = await Promise.all([
        git.head(root),
        git.status(root),
        git.log(root, 30),
      ]);
      this.head = head;
      this.changes = changes;
      this.commits = commits;
      try {
        this.remotes = await git.remotes(root);
      } catch {
        this.remotes = [];
      }
    } catch (e) {
      this.error = String(e);
    } finally {
      this.loading = false;
    }
  }

  /** Detect the system git once (hosts without `available` are never "missing"). */
  detectGitAvailable(): void {
    const git = this.#git;
    if (!git?.available) {
      this.gitMissing = false;
      return;
    }
    git
      .available()
      .then((ok) => (this.gitMissing = !ok))
      .catch(() => (this.gitMissing = false));
  }

  // --- Local operations -----------------------------------------------------
  async #run(fn: () => Promise<unknown>): Promise<void> {
    const root = this.#getRoot();
    if (!this.#git || !root || this.busy) return;
    this.busy = true;
    this.error = undefined;
    try {
      await fn();
      await this.refresh();
    } catch (e) {
      this.error = String(e);
    } finally {
      this.busy = false;
    }
  }

  initRepo(): Promise<void> {
    return this.#run(() => this.#git!.init(this.#getRoot()!));
  }
  stage(paths: string[]): Promise<void> {
    return this.#run(() => this.#git!.stage(this.#getRoot()!, paths));
  }
  unstage(paths: string[]): Promise<void> {
    return this.#run(() => this.#git!.unstage(this.#getRoot()!, paths));
  }

  /** Revert working-tree changes after a native confirmation. */
  discard(paths: string[]): Promise<void> {
    return this.#run(async () => {
      const msg =
        paths.length === 1
          ? `Discard changes in ${paths[0]}?\n\nThis cannot be undone.`
          : `Discard changes in ${paths.length} files?\n\nThis cannot be undone.`;
      if (!(await this.#askConfirm(msg))) return;
      await this.#git!.discard(this.#getRoot()!, paths);
    });
  }

  commit(): void {
    if (!this.canCommit) return;
    void this.#run(async () => {
      const msg =
        this.message.trim() ||
        (this.head?.merging
          ? `Merge ${this.head?.upstream ?? "remote branch"}`
          : "");
      await this.#git!.commit(this.#getRoot()!, msg);
      this.message = "";
    });
  }

  // --- Remote operations ----------------------------------------------------
  /** Run a remote operation; route any failure to the error dialog. */
  async #runRemote(op: string, fn: () => Promise<unknown>): Promise<void> {
    const root = this.#getRoot();
    if (!this.#git || !root || this.busy) return;
    // Up-front, plain-language gate: skip the doomed attempt when git is absent.
    if (this.gitMissing) {
      this.gitError = {
        title: "Git isn’t installed",
        message:
          "Syncing with a remote needs Git installed on your computer. Install it from git-scm.com, then reopen GlyphTeX and try again.",
      };
      return;
    }
    this.busy = true;
    this.remoteMsg = undefined;
    try {
      await fn();
      await this.refresh();
    } catch (e) {
      this.gitError = describeError(String(e), op);
      this.showErrorDetails = false;
      await this.refresh(); // reflect any state that did change (e.g. the remote list)
    } finally {
      this.busy = false;
    }
  }

  /** Guard: a remote op needs an active remote — surface a clear dialog if not. */
  #requireRemote(op: string): boolean {
    if (this.activeRemote) return true;
    this.gitError = {
      title: "No remote configured",
      message: "Add a remote below before you can " + op.toLowerCase() + ".",
    };
    return false;
  }

  doFetch(): void {
    if (!this.#requireRemote("Fetch")) return;
    void this.#runRemote("Fetch", async () => {
      await this.#git!.fetch(this.#getRoot()!, this.#authedUrl());
      this.remoteMsg = "Fetched.";
    });
  }
  doPull(): void {
    if (!this.#requireRemote("Pull")) return;
    void this.#runRemote("Pull", async () => {
      this.remoteMsg =
        (await this.#git!.pull(this.#getRoot()!, this.#authedUrl())) ||
        "Already up to date.";
    });
  }
  doPush(): void {
    if (!this.#requireRemote("Push")) return;
    void this.#runRemote("Push", async () => {
      this.remoteMsg =
        (await this.#git!.push(
          this.#getRoot()!,
          this.#authedUrl(),
          this.head?.branch ?? undefined,
          this.activeRemote?.name,
        )) || "Pushed.";
    });
  }
  /** Pull (merge) then push — VS Code's "Sync Changes". Surfaces conflicts. */
  doSync(): void {
    if (!this.#requireRemote("Sync")) return;
    void this.#runRemote("Sync", async () => {
      const r = await this.#git!.sync(
        this.#getRoot()!,
        this.#authedUrl(),
        this.head?.branch ?? undefined,
        this.activeRemote?.name,
      );
      if (r.conflicts) {
        this.gitError = { title: "Merge conflicts", message: r.message };
      } else {
        this.remoteMsg = r.message || "Synced with remote.";
      }
    });
  }
  /** Run whatever the smart primary button currently represents. */
  runPrimarySync(): void {
    if (this.syncAction === "push") this.doPush();
    else if (this.syncAction === "pull") this.doPull();
    else if (this.syncAction === "sync") this.doSync();
  }

  // --- Remote management ----------------------------------------------------
  startEditRemote(r: GitRemote): void {
    this.editingRemote = r.name;
    this.editName = r.name;
    this.editUrl = r.url;
    this.addingRemote = false;
  }
  saveRemote(r: GitRemote): void {
    const name = this.editName.trim();
    const url = this.editUrl.trim();
    if (!name || !url) return;
    void this.#runRemote("Update remote", async () => {
      if (url !== r.url) await this.#git!.remoteSetUrl(this.#getRoot()!, r.name, url);
      if (name !== r.name) {
        await this.#git!.remoteRename(this.#getRoot()!, r.name, name);
        if (this.selectedRemote === r.name) this.selectedRemote = name;
      }
      this.editingRemote = null;
    });
  }
  removeRemote(r: GitRemote): void {
    void this.#runRemote("Remove remote", async () => {
      if (!(await this.#askConfirm(`Remove remote “${r.name}”?\n${r.url}`)))
        return;
      await this.#git!.remoteRemove(this.#getRoot()!, r.name);
      if (this.selectedRemote === r.name) this.selectedRemote = "";
    });
  }
  addRemote(): void {
    const name = this.newRemoteName.trim();
    const url = this.newRemoteUrl.trim();
    if (!name || !url) return;
    void this.#runRemote("Add remote", async () => {
      await this.#git!.remoteAdd(this.#getRoot()!, name, url);
      this.selectedRemote = name;
      this.addingRemote = false;
      this.newRemoteName = "origin";
      this.newRemoteUrl = "";
    });
  }

  /** Toggle the "Add remote" form (and ensure the section is open). */
  startAddRemote(): void {
    this.sections.remotes = true;
    this.addingRemote = !this.addingRemote;
    this.editingRemote = null;
  }
}
