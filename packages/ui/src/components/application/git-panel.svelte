<script lang="ts" module>
	export type GitChange = { path: string; status: string; staged: boolean };
	export type GitCommitEntry = { hash: string; summary: string; author: string; time: number };
	export type GitHeadInfo = {
		branch: string | null;
		unborn: boolean;
		/** Upstream tracking branch (e.g. `origin/main`), if configured. */
		upstream?: string | null;
		/** Commits ahead of upstream (undefined / null when no upstream). */
		ahead?: number | null;
		/** Commits behind upstream. */
		behind?: number | null;
	};

	/** Host-injected Git backend (desktop = Tauri / gitoxide). */
	export type GitProvider = {
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
		/** Push current branch (system git); `url` carries token auth. */
		push: (root: string, url?: string, branch?: string) => Promise<string>;
		/** Native confirmation dialog (desktop wires Tauri's); falls back to window.confirm. */
		confirm?: (message: string, title?: string) => Promise<boolean>;
	};

	export type GitRemote = { name: string; url: string };
</script>

<script lang="ts">
	import { Button } from '@glyphx/ui/button';
	import { Textarea } from '@glyphx/ui/textarea';
	import { settings } from '@glyphx/ui/settings';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import {
		IconGitBranch,
		IconGitCommit,
		IconHistory,
		IconPlus,
		IconMinus,
		IconArrowBackUp,
		IconPencil,
		IconTrash,
		IconCheck,
		IconX,
		IconCloud,
		IconChevronRight,
		IconFolder,
		IconFolderOpen,
		IconFileText,
		IconArrowUp,
		IconArrowDown
	} from '@tabler/icons-svelte';

	/**
	 * Source Control — local version control for the open project folder. Stage /
	 * unstage / discard working-tree changes against the real Git index, commit the
	 * staged set, browse history, and manage remotes (add / edit / switch / remove,
	 * fetch / pull / push).
	 */
	let {
		git,
		root,
		refreshKey = 0,
		onstatechange
	}: {
		git?: GitProvider;
		root?: string | null;
		/** Bump from the parent (side-panel header refresh button) to force a re-fetch. */
		refreshKey?: number;
		/** Reports panel state up so the side-panel header can show/disable actions. */
		onstatechange?: (s: { isRepo: boolean; loading: boolean }) => void;
	} = $props();

	let isRepo = $state(false);
	let head = $state<GitHeadInfo | undefined>(undefined);
	let changes = $state<GitChange[]>([]);
	let commits = $state<GitCommitEntry[]>([]);
	let message = $state('');

	let loading = $state(false);
	let busy = $state(false);
	let error = $state<string | undefined>(undefined);

	// Inline diff view for a clicked file.
	let openPath = $state<string | null>(null);
	let openStaged = $state(false);
	let diffText = $state('');
	let diffLoading = $state(false);

	async function showDiff(c: GitChange) {
		if (openPath === c.path && openStaged === c.staged) {
			openPath = null; // toggle closed
			return;
		}
		openPath = c.path;
		openStaged = c.staged;
		diffText = '';
		diffLoading = true;
		try {
			diffText = (await git?.diff(root!, c.path, c.staged)) ?? '';
		} catch (e) {
			diffText = String(e);
		} finally {
			diffLoading = false;
		}
	}

	const diffLines = $derived(diffText ? diffText.replace(/\n$/, '').split('\n') : []);
	function lineClass(l: string): string {
		if (l.startsWith('+') && !l.startsWith('+++')) return 'text-success';
		if (l.startsWith('-') && !l.startsWith('---')) return 'text-destructive';
		if (l.startsWith('@@')) return 'text-brand';
		return 'text-muted-foreground/80';
	}

	// Remotes
	let remotes = $state<GitRemote[]>([]);
	let token = $state('');
	let showToken = $state(false);
	let remoteMsg = $state<string | undefined>(undefined);
	// Which remote fetch/pull/push act on; falls back to origin / first.
	let selectedRemote = $state('');
	const activeRemote = $derived(
		remotes.find((r) => r.name === selectedRemote) ??
			remotes.find((r) => r.name === 'origin') ??
			remotes[0]
	);
	const hasRemote = $derived(remotes.length > 0);

	// Inline remote editing / adding (no custom dialog — native confirm for removal).
	let editingRemote = $state<string | null>(null);
	let editName = $state('');
	let editUrl = $state('');
	let addingRemote = $state(false);
	let newRemoteName = $state('origin');
	let newRemoteUrl = $state('');

	/** The active remote's URL with the access token injected for HTTPS auth. */
	function authedUrl(): string | undefined {
		const base = activeRemote?.url;
		if (!base) return undefined;
		const t = token.trim();
		if (!t) return base;
		try {
			const u = new URL(base);
			u.username = 'x-access-token';
			u.password = t;
			return u.toString();
		} catch {
			return base;
		}
	}

	/** Native OS confirm (desktop) with a window.confirm fallback (web). */
	async function askConfirm(msg: string): Promise<boolean> {
		if (git?.confirm) return git.confirm(msg, 'GlyphX');
		return typeof window !== 'undefined' ? window.confirm(msg) : true;
	}

	const inputCls =
		'border-border bg-background focus:ring-brand/40 w-full rounded border px-2 py-1 text-xs outline-none focus:ring-2';

	const staged = $derived(changes.filter((c) => c.staged));
	const unstaged = $derived(changes.filter((c) => !c.staged));

	// --- Changes view: flat list vs folder tree (VS Code-style) -------------
	// View mode is persisted in settings and toggled from the side-panel header.
	let collapsed = $state(new Set<string>());

	type TreeNode = {
		/** Display segment — a folder may be a compressed chain like `src/lib`. */
		name: string;
		/** Folder path (for collapse) or full file path. */
		path: string;
		isFile: boolean;
		change?: GitChange;
		children: TreeNode[];
	};

	function buildTree(items: GitChange[]): TreeNode[] {
		const root: TreeNode = { name: '', path: '', isFile: false, children: [] };
		for (const c of items) {
			const parts = c.path.split('/');
			let node = root;
			let acc = '';
			parts.forEach((part, i) => {
				acc = acc ? `${acc}/${part}` : part;
				const isFile = i === parts.length - 1;
				let child = node.children.find((n) => n.name === part && n.isFile === isFile);
				if (!child) {
					child = {
						name: part,
						path: isFile ? c.path : acc,
						isFile,
						change: isFile ? c : undefined,
						children: []
					};
					node.children.push(child);
				}
				node = child;
			});
		}
		// Nest level-by-level like the Explorer (no folder compression).
		return sortNodes(root.children);
	}

	function sortNodes(nodes: TreeNode[]): TreeNode[] {
		nodes.sort((a, b) =>
			a.isFile !== b.isFile
				? a.isFile
					? 1
					: -1
				: a.name.localeCompare(b.name, undefined, { numeric: true })
		);
		for (const n of nodes) if (!n.isFile) sortNodes(n.children);
		return nodes;
	}

	function toggleFolder(path: string) {
		const next = new Set(collapsed);
		if (next.has(path)) next.delete(path);
		else next.add(path);
		collapsed = next;
	}

	/** Indentation matching the Explorer tree. */
	const indent = (d: number) => `${d * 12 + 8}px`;
	/** Last path segment (the file name without its directory). */
	const leaf = (p: string) => p.split('/').pop() ?? p;

	const stagedTree = $derived(buildTree(staged));
	const unstagedTree = $derived(buildTree(unstaged));
	const canCommit = $derived(
		isRepo && !busy && message.trim().length > 0 && staged.length > 0
	);

	async function refresh() {
		if (!git || !root) return;
		loading = true;
		error = undefined;
		try {
			openPath = null; // close any stale inline diff
			isRepo = await git.isRepo(root);
			if (!isRepo) {
				changes = [];
				commits = [];
				head = undefined;
				return;
			}
			[head, changes, commits] = await Promise.all([
				git.head(root),
				git.status(root),
				git.log(root, 30)
			]);
			try {
				remotes = await git.remotes(root);
			} catch {
				remotes = [];
			}
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	// Reload whenever the open folder changes, or the header refresh is clicked.
	$effect(() => {
		void root;
		void refreshKey;
		refresh();
	});

	// Surface state to the side-panel header (which owns the action icons).
	$effect(() => {
		onstatechange?.({ isRepo, loading });
	});

	async function run(fn: () => Promise<unknown>) {
		if (!git || !root || busy) return;
		busy = true;
		error = undefined;
		try {
			await fn();
			await refresh();
		} catch (e) {
			error = String(e);
		} finally {
			busy = false;
		}
	}

	const initRepo = () => run(() => git!.init(root!));
	const stage = (paths: string[]) => run(() => git!.stage(root!, paths));
	const unstage = (paths: string[]) => run(() => git!.unstage(root!, paths));

	/** Revert working-tree changes after a native confirmation. */
	const discard = (paths: string[]) =>
		run(async () => {
			const msg =
				paths.length === 1
					? `Discard changes in ${paths[0]}?\n\nThis cannot be undone.`
					: `Discard changes in ${paths.length} files?\n\nThis cannot be undone.`;
			if (!(await askConfirm(msg))) return;
			await git!.discard(root!, paths);
		});

	function commit() {
		if (!canCommit) return;
		run(async () => {
			await git!.commit(root!, message.trim());
			message = '';
		});
	}

	const doFetch = () =>
		run(async () => {
			remoteMsg = undefined;
			await git!.fetch(root!, authedUrl());
			remoteMsg = 'Fetched.';
		});
	const doPull = () =>
		run(async () => {
			remoteMsg = undefined;
			remoteMsg = (await git!.pull(root!, authedUrl())) || 'Already up to date.';
		});
	const doPush = () =>
		run(async () => {
			remoteMsg = undefined;
			remoteMsg = (await git!.push(root!, authedUrl(), head?.branch ?? undefined)) || 'Pushed.';
		});

	// --- Remote management ---------------------------------------------------
	function startEditRemote(r: GitRemote) {
		editingRemote = r.name;
		editName = r.name;
		editUrl = r.url;
		addingRemote = false;
	}
	function saveRemote(r: GitRemote) {
		const name = editName.trim();
		const url = editUrl.trim();
		if (!name || !url) return;
		run(async () => {
			if (url !== r.url) await git!.remoteSetUrl(root!, r.name, url);
			if (name !== r.name) {
				await git!.remoteRename(root!, r.name, name);
				if (selectedRemote === r.name) selectedRemote = name;
			}
			editingRemote = null;
		});
	}
	const removeRemote = (r: GitRemote) =>
		run(async () => {
			if (!(await askConfirm(`Remove remote “${r.name}”?\n${r.url}`))) return;
			await git!.remoteRemove(root!, r.name);
			if (selectedRemote === r.name) selectedRemote = '';
		});
	function addRemote() {
		const name = newRemoteName.trim();
		const url = newRemoteUrl.trim();
		if (!name || !url) return;
		run(async () => {
			await git!.remoteAdd(root!, name, url);
			selectedRemote = name;
			addingRemote = false;
			newRemoteName = 'origin';
			newRemoteUrl = '';
		});
	}

	const STATUS_LABEL: Record<string, string> = {
		modified: 'M',
		deleted: 'D',
		untracked: 'U',
		added: 'A',
		renamed: 'R'
	};
	const STATUS_CLASS: Record<string, string> = {
		modified: 'text-warning',
		deleted: 'text-destructive',
		untracked: 'text-success',
		added: 'text-success',
		renamed: 'text-brand'
	};

	function when(secs: number): string {
		return new Date(secs * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
</script>

{#snippet fileRow(c: GitChange, action: 'stage' | 'unstage', label: string, depth: number, tree: boolean)}
	{@const open = openPath === c.path && openStaged === c.staged}
	<div>
		<div
			class="hover:bg-muted/60 group flex items-center gap-1 rounded py-0.5 pr-1 text-xs"
			style:padding-left={tree ? indent(depth) : '4px'}
		>
			<button
				class="text-foreground/90 hover:text-foreground flex min-w-0 flex-1 items-center gap-1 text-left {open
					? 'font-medium'
					: ''}"
				title="Show diff — {c.path}"
				onclick={() => showDiff(c)}
			>
				{#if tree}
					<span class="w-[13px] shrink-0"></span>
					<IconFileText size={14} class="text-muted-foreground shrink-0" />
				{/if}
				<span class="truncate">{label}</span>
			</button>
			{#if action === 'stage'}
				<Button
					variant="ghost"
					size="icon-xs"
					class="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
					title="Discard changes"
					aria-label="Discard changes"
					disabled={busy}
					onclick={() => discard([c.path])}
				>
					<IconArrowBackUp size={13} />
				</Button>
			{/if}
			<Button
				variant="ghost"
				size="icon-xs"
				class="opacity-0 group-hover:opacity-100"
				title={action === 'stage' ? 'Stage' : 'Unstage'}
				aria-label={action === 'stage' ? 'Stage' : 'Unstage'}
				disabled={busy}
				onclick={() => (action === 'stage' ? stage([c.path]) : unstage([c.path]))}
			>
				{#if action === 'stage'}<IconPlus size={13} />{:else}<IconMinus size={13} />{/if}
			</Button>
			<span class="shrink-0 font-mono text-[10px] {STATUS_CLASS[c.status] ?? ''}">
				{STATUS_LABEL[c.status] ?? '?'}
			</span>
		</div>
		{#if open}
			<div class="border-border/60 mx-1 my-1 overflow-auto rounded border">
				{#if diffLoading}
					<p class="text-muted-foreground p-2 text-[11px]">Loading diff…</p>
				{:else if !diffLines.length}
					<p class="text-muted-foreground p-2 text-[11px]">No textual diff (binary or empty).</p>
				{:else}
					<pre class="max-h-64 overflow-auto p-2 font-mono text-[10.5px] leading-snug"><!--
					-->{#each diffLines as l, i (i)}<span class="{lineClass(l)} block whitespace-pre">{l || ' '}</span>{/each}</pre>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet treeView(nodes: TreeNode[], action: 'stage' | 'unstage', depth: number)}
	{#each nodes as n (n.path)}
		{#if n.isFile && n.change}
			{@render fileRow(n.change, action, n.name, depth, true)}
		{:else if !n.isFile}
			{@const expanded = !collapsed.has(n.path)}
			<button
				class="hover:bg-muted hover:text-foreground text-muted-foreground flex w-full items-center gap-1 rounded py-0.5 pr-1 text-left text-xs transition-colors"
				style:padding-left={indent(depth)}
				aria-expanded={expanded}
				onclick={() => toggleFolder(n.path)}
				title={n.path}
			>
				<IconChevronRight
					size={13}
					class="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] {expanded
						? 'rotate-90'
						: ''}"
				/>
				{#if expanded}<IconFolderOpen size={14} class="text-muted-foreground shrink-0" />{:else}<IconFolder
						size={14}
						class="text-muted-foreground shrink-0"
					/>{/if}
				<span class="truncate">{n.name}</span>
			</button>
			{#if expanded}
				<div transition:slide={{ duration: 200, easing: cubicOut }}>
					{@render treeView(n.children, action, depth + 1)}
				</div>
			{/if}
		{/if}
	{/each}
{/snippet}

{#snippet changeSection(items: GitChange[], nodes: TreeNode[], action: 'stage' | 'unstage')}
	{#if settings.gitView === 'tree'}
		{@render treeView(nodes, action, 0)}
	{:else}
		{#each items as c (c.path)}
			{@render fileRow(c, action, leaf(c.path), 0, false)}
		{/each}
	{/if}
{/snippet}

{#if !root}
	<div class="text-muted-foreground flex flex-col items-center gap-2 px-2 py-8 text-center text-xs">
		<IconGitBranch size={22} />
		<p>Open a folder to use source control.</p>
	</div>
{:else if !isRepo}
	<div class="text-muted-foreground flex flex-col items-center gap-2 px-2 py-8 text-center text-xs">
		<IconGitBranch size={22} />
		<p>This folder isn't a Git repository yet.</p>
		<Button variant="outline" size="sm" class="mt-1" disabled={busy} onclick={initRepo}>
			{busy ? 'Initializing…' : 'Initialize repository'}
		</Button>
	</div>
{:else}
	<div class="flex flex-col gap-2 px-1">
		<!-- Branch + ahead/behind (panel chrome — refresh / view toggle live in the
		     side-panel header, next to the "Source Control" heading). -->
		<div class="flex items-center gap-1.5 px-0.5">
			<IconGitBranch size={13} class="text-muted-foreground shrink-0" />
			<span class="text-foreground min-w-0 flex-1 truncate text-xs font-medium">
				{head?.branch ?? 'HEAD'}{head?.unborn ? ' (no commits yet)' : ''}
			</span>
			{#if head?.behind || head?.ahead}
				<span
					class="text-muted-foreground/80 flex shrink-0 items-center gap-0.5 text-[10px]"
					title={`${head?.ahead ?? 0} ahead, ${head?.behind ?? 0} behind ${head?.upstream ?? 'upstream'}`}
				>
					{#if head?.behind}<IconArrowDown size={11} />{head.behind}{/if}
					{#if head?.ahead}<IconArrowUp size={11} />{head.ahead}{/if}
				</span>
			{/if}
		</div>

		<!-- Commit box -->
		<Textarea bind:value={message} placeholder="Commit message" rows={2} class="resize-none text-xs" />
		<Button size="sm" disabled={!canCommit} onclick={commit}>
			<IconGitCommit size={14} />
			{busy ? 'Committing…' : `Commit${staged.length ? ` ${staged.length}` : ''}`}
		</Button>

		{#if error}
			<p class="text-destructive px-0.5 text-[11px] leading-snug">{error}</p>
		{/if}

		<!-- Staged -->
		{#if staged.length}
			<div class="mt-1 flex flex-col gap-0.5">
				<div class="flex items-center px-0.5">
					<span class="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
						Staged Changes ({staged.length})
					</span>
					<Button
						variant="ghost"
						size="xs"
						class="ml-auto"
						disabled={busy}
						onclick={() => unstage(staged.map((c) => c.path))}
					>
						Unstage all
					</Button>
				</div>
				{@render changeSection(staged, stagedTree, 'unstage')}
			</div>
		{/if}

		<!-- Changes (unstaged) -->
		<div class="mt-1 flex flex-col gap-0.5">
			<div class="flex items-center px-0.5">
				<span class="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
					Changes{unstaged.length ? ` (${unstaged.length})` : ''}
				</span>
				{#if unstaged.length}
					<Button
						variant="ghost"
						size="xs"
						class="text-muted-foreground hover:text-destructive ml-auto"
						title="Discard all changes"
						disabled={busy}
						onclick={() => discard(unstaged.map((c) => c.path))}
					>
						Discard all
					</Button>
					<Button
						variant="ghost"
						size="xs"
						disabled={busy}
						onclick={() => stage(unstaged.map((c) => c.path))}
					>
						Stage all
					</Button>
				{/if}
			</div>
			{#if !unstaged.length}
				<p class="text-muted-foreground/70 px-0.5 py-1 text-[11px]">
					{loading ? 'Checking…' : staged.length ? 'Nothing else to stage.' : 'No changes.'}
				</p>
			{:else}
				{@render changeSection(unstaged, unstagedTree, 'stage')}
			{/if}
		</div>

		<!-- Remotes -->
		<div class="border-border/60 mt-1 flex flex-col gap-1.5 border-t pt-1.5">
			<div class="flex items-center gap-1 px-0.5">
				<span class="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
					Remotes{remotes.length ? ` (${remotes.length})` : ''}
				</span>
				<Button
					variant="ghost"
					size="xs"
					class="ml-auto"
					title="Add a remote"
					disabled={busy}
					onclick={() => {
						addingRemote = !addingRemote;
						editingRemote = null;
					}}
				>
					<IconPlus size={12} /> Add
				</Button>
			</div>

			<!-- Add-remote form -->
			{#if addingRemote}
				<div class="border-border/60 flex flex-col gap-1 rounded border p-1.5">
					<input bind:value={newRemoteName} placeholder="Name (e.g. origin)" class={inputCls} />
					<input
						bind:value={newRemoteUrl}
						placeholder="https://github.com/owner/repo.git"
						class={inputCls}
					/>
					<div class="flex gap-1.5">
						<Button
							size="xs"
							disabled={busy || !newRemoteName.trim() || !newRemoteUrl.trim()}
							onclick={addRemote}
						>
							Add remote
						</Button>
						<Button variant="ghost" size="xs" onclick={() => (addingRemote = false)}>Cancel</Button>
					</div>
				</div>
			{/if}

			<!-- Remote list (radio = active when several) -->
			{#each remotes as r (r.name)}
				{#if editingRemote === r.name}
					<div class="border-border/60 flex flex-col gap-1 rounded border p-1.5">
						<input bind:value={editName} placeholder="Name" class={inputCls} />
						<input bind:value={editUrl} placeholder="URL" class={inputCls} />
						<div class="flex gap-1.5">
							<Button
								size="xs"
								disabled={busy || !editName.trim() || !editUrl.trim()}
								onclick={() => saveRemote(r)}
							>
								<IconCheck size={12} /> Save
							</Button>
							<Button variant="ghost" size="xs" onclick={() => (editingRemote = null)}>
								<IconX size={12} /> Cancel
							</Button>
						</div>
					</div>
				{:else}
					<div
						class="hover:bg-muted/60 group flex items-center gap-1.5 rounded px-1 py-0.5 text-xs"
					>
						{#if remotes.length > 1}
							<input
								type="radio"
								name="active-remote"
								class="accent-brand shrink-0"
								checked={activeRemote?.name === r.name}
								title="Use this remote for fetch / pull / push"
								onchange={() => (selectedRemote = r.name)}
							/>
						{:else}
							<IconCloud size={12} class="text-muted-foreground shrink-0" />
						{/if}
						<div class="min-w-0 flex-1">
							<p class="text-foreground/90 truncate font-medium">{r.name}</p>
							<p class="text-muted-foreground/70 truncate text-[10px]" title={r.url}>{r.url}</p>
						</div>
						<Button
							variant="ghost"
							size="icon-xs"
							class="opacity-0 group-hover:opacity-100"
							title="Edit remote"
							aria-label="Edit remote"
							disabled={busy}
							onclick={() => startEditRemote(r)}
						>
							<IconPencil size={12} />
						</Button>
						<Button
							variant="ghost"
							size="icon-xs"
							class="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
							title="Remove remote"
							aria-label="Remove remote"
							disabled={busy}
							onclick={() => removeRemote(r)}
						>
							<IconTrash size={12} />
						</Button>
					</div>
				{/if}
			{/each}

			{#if hasRemote}
				<div class="flex items-center gap-1 px-0.5">
					{#if activeRemote}
						<span class="text-muted-foreground/70 text-[10px]">
							Using <span class="text-foreground/80 font-medium">{activeRemote.name}</span>
						</span>
					{/if}
					<button
						class="text-muted-foreground hover:text-foreground ml-auto text-[10px]"
						onclick={() => (showToken = !showToken)}
					>
						{showToken ? 'Hide token' : 'Token'}
					</button>
				</div>
				{#if showToken}
					<input
						type="password"
						bind:value={token}
						placeholder="Access token (for private repos)"
						class={inputCls}
					/>
				{/if}
				<div class="flex gap-1.5">
					<Button variant="outline" size="xs" disabled={busy} onclick={doFetch}>Fetch</Button>
					<Button variant="outline" size="xs" disabled={busy} onclick={doPull}>Pull</Button>
					<Button variant="outline" size="xs" disabled={busy} onclick={doPush}>Push</Button>
				</div>
				{#if remoteMsg}
					<p class="text-muted-foreground/80 px-0.5 text-[11px] leading-snug break-words">
						{remoteMsg}
					</p>
				{/if}
			{:else if !addingRemote}
				<p class="text-muted-foreground/70 px-0.5 text-[11px]">
					No remotes. Add one to push or pull.
				</p>
			{/if}
		</div>

		<!-- History -->
		{#if commits.length}
			<div class="border-border/60 mt-1 flex flex-col gap-0.5 border-t pt-1.5">
				<span
					class="text-muted-foreground flex items-center gap-1 px-0.5 text-[10px] font-medium tracking-wide uppercase"
				>
					<IconHistory size={11} /> History
				</span>
				{#each commits as c (c.hash)}
					<div class="flex items-baseline gap-1.5 px-0.5 py-0.5 text-xs" title={c.author}>
						<span class="text-muted-foreground/70 shrink-0 font-mono text-[10px]">{c.hash}</span>
						<span class="text-foreground/85 truncate">{c.summary}</span>
						<span class="text-muted-foreground/50 ml-auto shrink-0 text-[10px]">{when(c.time)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
