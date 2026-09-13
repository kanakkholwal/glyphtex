<script lang="ts" module>
	import type { Project } from "@glyphtex/ui/projects";
	export type { Project };

	/** A rail destination. Each one is a real route when the host supplies hrefs. */
	export type Scope = "all" | "recent" | "starred" | "templates";
</script>

<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '@glyphtex/ui/dialog';
	import {
		DropdownMenu,
		DropdownMenuCheckboxItem,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '@glyphtex/ui/dropdown-menu';
	import { Logo } from '@glyphtex/ui/logo';
	import { projectViewTransitionName } from '@glyphtex/ui/projects';
	import * as Sidebar from '@glyphtex/ui/sidebar';
	import { ThemeToggle } from '@glyphtex/ui/theme-toggle';
	import {
		IconArrowsSort,
		IconChevronDown,
		IconClock,
		IconCloudDownload,
		IconCopy,
		IconDotsVertical,
		IconExternalLink,
		IconFileImport,
		IconFolderOpen,
		IconFolderShare,
		IconHelpCircle,
		IconHome,
		IconInfoCircle,
		IconLayoutGrid,
		IconLayoutList,
		IconPencil,
		IconPlus,
		IconSearch,
		IconSettings,
		IconStar,
		IconStarFilled,
		IconTemplate,
		IconTrash,
		IconX
	} from '@tabler/icons-svelte';
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import AboutDialog from './about-dialog.svelte';
	import { motionMs as ms } from './motion';

	/** Home screen listing every project as a card. The host owns the data and every
	 *  action; an absent handler hides its control (folder actions are desktop-only). */
	let {
		platform = 'desktop',
		projects = [],
		oncreate,
		onopenfolder,
		onimport,
		onimportfolder,
		onclone,
		onopen,
		onrename,
		onduplicate,
		ondelete,
		onreveal,
		onsettings,
		onstar,
		storage,
		helpHref,
		activeScope = 'all',
		scopeHrefs,
		loading = false
	}: {
		/** Drives the About dialog's platform line. */
		platform?: 'web' | 'desktop';
		projects?: Project[];
		/** Create a project. Return the new id to have the home open it; no id means the host navigates. */
		oncreate?: () => string | void | Promise<string | void>;
		/** Open an existing project folder from disk (desktop). */
		onopenfolder?: () => void;
		/** Import a .zip project. */
		onimport?: () => void;
		/** Import a folder from disk, copying it into the project store. */
		onimportfolder?: () => void;
		/** Clone a Git repository by URL (desktop). */
		onclone?: (url: string) => void | Promise<void>;
		onopen?: (id: string) => void;
		onrename?: (id: string, name: string) => void;
		onduplicate?: (id: string) => void;
		ondelete?: (id: string) => void;
		/** Reveal a disk-backed project's folder in the OS file manager (desktop). */
		onreveal?: (id: string) => void;
		/** Open the app settings page (desktop). */
		onsettings?: () => void;
		/** Toggle a project's star. Absent hides the star action. */
		onstar?: (id: string, starred: boolean) => void;
		/** Local-storage meter for the sidebar. Absent hides the card. */
		storage?: { used: number; total: number };
		/** Docs link target for the sidebar. Opens outside the workspace. */
		helpHref?: string;
		/** Which rail destination the host is currently rendering. */
		activeScope?: Scope;
		/** Route per destination. A scope with no href is not offered at all. */
		scopeHrefs?: Partial<Record<Scope, string>>;
		/** First read of the project store. The shell renders; the grid skeletons. */
		loading?: boolean;
	} = $props();

	type Sort = 'newest' | 'oldest' | 'name';

	const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

	const scope = $derived(activeScope);
	let sort = $state<Sort>('newest');
	let view = $state<'grid' | 'list'>('grid');
	let query = $state('');
	let renaming = $state<string | null>(null);
	let renameValue = $state('');
	let aboutOpen = $state(false);
	let pendingDelete = $state<Project | null>(null);

	let searchOpen = $state(false);
	let searchEl = $state<HTMLInputElement>();

	async function openSearch() {
		searchOpen = true;
		await tick();
		searchEl?.focus();
	}
	function closeSearch() {
		query = '';
		searchOpen = false;
	}
	// "/" is the list's search shortcut. Ignored while the caret is in a field so
	// it can still be typed into a project name.
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
		const t = e.target as HTMLElement | null;
		if (t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName ?? '')) return;
		e.preventDefault();
		openSearch();
	}

	let scrollEl = $state<HTMLElement>();
	let scrolled = $state(false);
	function onScroll() {
		scrolled = (scrollEl?.scrollTop ?? 0) > 4;
	}

	async function handleCreate() {
		const id = await oncreate?.();
		// A host that returns no id navigates on its own (legacy): nothing to do.
		if (typeof id !== 'string') return;
		// Straight through: a 400ms wait for a settled morph was dead air on the primary action.
		onopen?.(id);
	}

	let cloning = $state(false);
	let cloneUrl = $state('');
	let cloneBusy = $state(false);

	async function submitClone() {
		const url = cloneUrl.trim();
		if (!url || cloneBusy) return;
		cloneBusy = true;
		try {
			await onclone?.(url);
			cloneUrl = '';
			cloning = false;
		} finally {
			cloneBusy = false;
		}
	}

	const recent = $derived(projects.filter((p) => Date.now() - p.updatedAt < RECENT_MS));
	const starred = $derived(projects.filter((p) => p.starred));

	const scoped = $derived(
		scope === 'starred'
			? starred
			: scope === 'recent'
				? recent
				: scope === 'templates'
					? []
					: projects
	);

	const filtered = $derived(
		scoped
			.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
			.toSorted((a, b) =>
				sort === 'name'
					? a.name.localeCompare(b.name)
					: sort === 'oldest'
						? a.updatedAt - b.updatedAt
						: b.updatedAt - a.updatedAt
			)
	);

	const scopes: { id: Scope; label: string; icon: typeof IconPlus }[] = [
		{ id: 'all', label: 'All projects', icon: IconHome },
		{ id: 'recent', label: 'Recent', icon: IconClock },
		{ id: 'starred', label: 'Starred', icon: IconStar },
		{ id: 'templates', label: 'Templates', icon: IconTemplate }
	];

	// One 28px row treatment for the rail; active is the base fill and weight plus a blue icon.
	const railRow = 'h-7 rounded-md px-2';
	const groupLabel = 'text-muted-foreground h-6 px-2 text-xs font-medium';

	const scopeLabel = $derived(scopes.find((s) => s.id === scope)?.label ?? 'All projects');
	const ScopeIcon = $derived(scopes.find((s) => s.id === scope)?.icon ?? IconHome);

	const sorts: { id: Sort; label: string }[] = [
		{ id: 'newest', label: 'Newest first' },
		{ id: 'oldest', label: 'Oldest first' },
		{ id: 'name', label: 'Name (A-Z)' }
	];

	const storagePct = $derived(
		storage && storage.total > 0 ? Math.min(100, (storage.used / storage.total) * 100) : 0
	);

	function formatBytes(bytes: number): string {
		if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / 1024 ** i;
		return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
	}

	function relativeTime(ts: number): string {
		const diff = Date.now() - ts;
		const min = Math.round(diff / 60_000);
		if (min < 1) return 'just now';
		if (min < 60) return `${min} min ago`;
		const hr = Math.round(min / 60);
		if (hr < 24) return `${hr} hr ago`;
		const day = Math.round(hr / 24);
		if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
		const mo = Math.round(day / 30);
		return `${mo} mo ago`;
	}

	function startRename(p: Project) {
		renaming = p.id;
		renameValue = p.name;
	}
	function commitRename(id: string) {
		const name = renameValue.trim();
		if (name) onrename?.(id, name);
		renaming = null;
	}

	function confirmDelete() {
		const p = pendingDelete;
		pendingDelete = null;
		if (p) ondelete?.(p.id);
	}

	// Deterministic-but-varied faux text lines so each card's "page" looks unique.
	function lineWidths(seed: string, n = 5): number[] {
		let h = 0;
		for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
		return Array.from({ length: n }, (_, i) => {
			h = (h * 1103515245 + 12345) >>> 0;
			return 55 + ((h >> (i + 3)) % 42); // 55-96%
		});
	}
</script>

{#snippet projectTitle(p: Project)}
	{#if renaming === p.id}
		<!-- svelte-ignore a11y_autofocus -->
		<input
			bind:value={renameValue}
			class="bg-card border-border text-foreground focus-visible:border-ring w-full rounded-md border px-1.5 py-0.5 text-sm font-medium outline-none"
			autofocus
			onkeydown={(e) => {
				if (e.key === 'Enter') commitRename(p.id);
				if (e.key === 'Escape') renaming = null;
			}}
			onblur={() => commitRename(p.id)}
		/>
	{:else}
		<button
			class="text-foreground hover:text-primary ease-craft block max-w-full truncate text-left text-sm font-medium transition-colors"
			onclick={() => onopen?.(p.id)}
		>
			{p.name}
		</button>
	{/if}
	<p class="text-muted-foreground mt-0.5 truncate text-xs">
		{#if p.root}
			<span title={p.root}>Edited {relativeTime(p.updatedAt)}</span>
		{:else}
			{p.files.length}
			{p.files.length === 1 ? 'file' : 'files'} · {relativeTime(p.updatedAt)}
		{/if}
	</p>
{/snippet}

{#snippet projectActions(p: Project)}
	<DropdownMenu>
		<DropdownMenuTrigger>
			{#snippet child({ props })}
				<button
					{...props}
					class="text-muted-foreground hover:bg-muted hover:text-foreground ease-craft -mr-1 grid size-7 shrink-0 place-items-center rounded-md opacity-0 transition-[opacity,colors] duration-200 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
					title="Project actions"
					aria-label={`Actions for ${p.name}`}
				>
					<IconDotsVertical size={15} />
				</button>
			{/snippet}
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end" class="w-50">
			{#if onstar}
				<DropdownMenuItem onclick={() => onstar?.(p.id, !p.starred)}>
					{#if p.starred}
						<IconStarFilled class="text-warning" /> Unstar
					{:else}
						<IconStar class="text-muted-foreground" /> Star
					{/if}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
			{/if}
			<DropdownMenuItem onclick={() => startRename(p)}>
				<IconPencil class="text-muted-foreground" /> Rename
			</DropdownMenuItem>
			<DropdownMenuItem onclick={() => onduplicate?.(p.id)}>
				<IconCopy class="text-muted-foreground" /> Duplicate
			</DropdownMenuItem>
			{#if onreveal && p.root}
				<DropdownMenuItem onclick={() => onreveal?.(p.id)} class="whitespace-nowrap">
					<IconFolderShare class="text-muted-foreground" /> Reveal in file manager
				</DropdownMenuItem>
			{/if}
			<DropdownMenuSeparator />
			<DropdownMenuItem variant="destructive" onclick={() => (pendingDelete = p)}>
				<IconTrash /> Delete
			</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
{/snippet}

<svelte:window onkeydown={onWindowKeydown} />

<a
	href="#main"
	class="bg-background text-foreground ring-ring sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-2"
>
	Skip to projects
</a>
<Sidebar.Provider class="text-foreground h-dvh min-h-0">
	<Sidebar.Root variant="sidebar" collapsible="icon" class="border-sidebar-border">
		<Sidebar.Header class="h-12 justify-center p-2">
			<!-- Collapsed, a 32px square centred in the 48px rail, in line with the icons below.
			     `self-center` is horizontal here: the header is a column. -->
			<a
				href={platform === 'web' ? '/' : '/workspace'}
				class="hover:bg-sidebar-accent flex h-8 items-center gap-2 rounded-md px-1.5 transition-colors group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:self-center group-data-[collapsible=icon]:px-0"
			>
				<Logo
					size={20}
					badge
					viewTransitionName="app-logo"
					class="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:[&>span:last-child]:hidden"
				/>
			</a>
		</Sidebar.Header>

		<Sidebar.Content class="gap-1">
			<Sidebar.Group class="px-2 py-0">
				<Sidebar.GroupLabel class="{groupLabel} group-data-[collapsible=icon]:hidden">
					Projects
				</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu aria-label="Project scopes">
						{#each scopes as item (item.id)}
							{@const Icon = item.icon}
							{@const href = scopeHrefs?.[item.id]}
							{#if href}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton
										isActive={activeScope === item.id}
										class="{railRow} data-active:[&>svg]:text-primary"
										tooltipContent={item.label}
									>
										{#snippet child({ props })}
											<a
												{href}
												{...props}
												aria-current={activeScope === item.id ? 'page' : undefined}
											>
												<Icon /><span>{item.label}</span>
											</a>
										{/snippet}
									</Sidebar.MenuButton>
								</Sidebar.MenuItem>
							{/if}
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>

			<!-- Settings, docs and About sit at the foot of the scroll area rather than
			     in the footer, which is reserved for the create action. -->
			<Sidebar.Group class="mt-auto px-2 py-0">
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#if onsettings}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									class={railRow}
									tooltipContent="Settings"
									onclick={() => onsettings?.()}
								>
									<IconSettings /><span>Settings</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/if}
						{#if helpHref}
							<Sidebar.MenuItem>
								<!-- Trailing IconExternalLink is the rail's convention for a row that
								     leaves the workspace; leading icons only ever name the thing. -->
								<Sidebar.MenuButton class={railRow} tooltipContent={'Help & Docs'}>
									{#snippet child({ props })}
										<a {...props} href={helpHref}>
											<IconHelpCircle /><span>Help &amp; Docs</span>
											<IconExternalLink
												class="text-muted-foreground ml-auto !size-3.5 group-data-[collapsible=icon]:hidden"
											/>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/if}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								class={railRow}
								tooltipContent="About GlyphTeX"
								onclick={() => (aboutOpen = true)}
							>
								<IconInfoCircle /><span>About GlyphTeX</span>
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>

		<Sidebar.Footer class="gap-3 p-2">
			{#if storage}
				<!-- Warning past 80%: the browser starts evicting under storage pressure. -->
				{@const tight = storagePct >= 80}
				<div class="px-1 group-data-[collapsible=icon]:hidden">
					<div class="text-muted-foreground flex items-center justify-between gap-2 text-xs">
						<span>Local storage</span>
						<span class="tabular-nums">
							{formatBytes(storage.used)} / {formatBytes(storage.total)}
						</span>
						{#if tight}<span class="sr-only">Storage nearly full</span>{/if}
					</div>
					<div class="bg-sidebar-accent mt-1.5 h-1 overflow-hidden rounded-full">
						<div
							class="h-full rounded-full transition-[width] duration-500 {tight
								? 'bg-warning'
								: 'bg-primary'}"
							style:width={`${Math.max(storagePct, 2)}%`}
						></div>
					</div>
				</div>
			{/if}

			<Button
				variant="secondary"
				class="h-9 w-full justify-center gap-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:px-0"
				title="New project"
				onclick={handleCreate}
			>
				<IconPlus class="text-primary" />
				<span class="group-data-[collapsible=icon]:hidden">New project</span>
			</Button>
		</Sidebar.Footer>

		<!-- Drag-handle-looking strip on the sidebar's edge; clicking it toggles
		     collapse, matching the Trigger in the content header. -->
		<Sidebar.Rail />
	</Sidebar.Root>

	<!-- Sidebar.Inset renders the page's one <main>; the id is the skip link's target. -->
	<Sidebar.Inset id="main" tabindex={-1} class="bg-background min-h-0 overflow-hidden outline-none">
		<div bind:this={scrollEl} onscroll={onScroll} class="min-h-0 min-w-0 flex-1 overflow-auto">
			<header
				class="sticky top-0 z-20 flex h-12 items-center gap-2 px-3 transition-colors duration-200 {scrolled
					? 'bg-background border-border border-b'
					: 'border-b border-transparent'}"
			>
				<Sidebar.Trigger title="Toggle sidebar (Ctrl/⌘ B)" />
				<Logo size={20} class="text-sm tracking-tight md:hidden" />
				<ScopeIcon size={15} class="text-muted-foreground ml-1 shrink-0" />
				<span class="truncate text-sm font-medium">{scopeLabel}</span>
				<div class="ml-auto flex items-center gap-0.5">
					<ThemeToggle size="icon-sm" />
				</div>
			</header>

			<div class="mx-auto w-full max-w-6xl px-6 pt-8 pb-20 sm:px-10 lg:px-14">
				<h1 class="text-heading font-medium">
					{scopeLabel}
				</h1>

				{#if onclone && cloning}
					<div
						class="border-border bg-background mt-4 flex items-center gap-2 rounded-lg border p-1.5"
					>
						<IconCloudDownload size={16} class="text-muted-foreground ml-1 shrink-0" />
						<!-- svelte-ignore a11y_autofocus -->
						<input
							bind:value={cloneUrl}
							class="text-foreground placeholder:text-placeholder h-10 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
							placeholder="Repository URL: https://github.com/owner/repo.git"
							spellcheck="false"
							autofocus
							disabled={cloneBusy}
							onkeydown={(e) => {
								if (e.key === 'Enter') submitClone();
								if (e.key === 'Escape') cloning = false;
							}}
						/>
						<Button disabled={cloneBusy || !cloneUrl.trim()} onclick={submitClone}>
							{cloneBusy ? 'Cloning…' : 'Clone'}
						</Button>
						<Button
							variant="ghost"
							disabled={cloneBusy}
							onclick={() => (cloning = false)}
						>
							Cancel
						</Button>
					</div>
				{/if}

				<div class="mt-5 flex items-center gap-1">
					<p class="text-muted-foreground mr-auto text-sm">
						{#if loading}
							Reading local storage…
						{:else if query.trim()}
							{filtered.length} of {scoped.length}
						{:else}
							{scoped.length}
							{scoped.length === 1 ? 'project' : 'projects'}
						{/if}
					</p>

					{#if searchOpen || query}
						<div class="relative w-64">
							<IconSearch
								size={15}
								class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
							/>
							<input
								bind:this={searchEl}
								bind:value={query}
								class="bg-background border-border text-foreground placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-ring/40 h-10 w-full rounded-md border py-1 pr-9 pl-9 text-sm outline-none focus-visible:ring-2"
								placeholder="Search projects"
								spellcheck="false"
								aria-label="Search projects"
								onkeydown={(e) => {
									if (e.key === 'Escape') closeSearch();
								}}
								onblur={() => {
									if (!query.trim()) searchOpen = false;
								}}
							/>
							{#if query}
								<button
									class="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
									onclick={closeSearch}
									aria-label="Clear search"
								>
									<IconX size={14} />
								</button>
							{/if}
						</div>
					{:else}
						<Button
							variant="ghost"
							size="icon"
							title="Search projects (/)"
							aria-label="Search projects"
							onclick={openSearch}
						>
							<IconSearch />
						</Button>
					{/if}

					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<Button
									{...props}
									variant="ghost"
									size="icon"
									title="Sort: {sorts.find((o) => o.id === sort)?.label}"
									aria-label="Sort projects"
								>
									<IconArrowsSort />
								</Button>
							{/snippet}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" class="w-44">
							{#each sorts as option (option.id)}
								<DropdownMenuCheckboxItem
									checked={sort === option.id}
									onCheckedChange={() => (sort = option.id)}
								>
									{option.label}
								</DropdownMenuCheckboxItem>
							{/each}
						</DropdownMenuContent>
					</DropdownMenu>

					<div class="flex items-center gap-0.5" role="group" aria-label="View mode">
						<Button
							variant={view === 'grid' ? 'secondary' : 'ghost'}
							size="icon"
							title="Grid view"
							aria-label="Grid view"
							aria-pressed={view === 'grid'}
							onclick={() => (view = 'grid')}
						>
							<IconLayoutGrid />
						</Button>
						<Button
							variant={view === 'list' ? 'secondary' : 'ghost'}
							size="icon"
							title="List view"
							aria-label="List view"
							aria-pressed={view === 'list'}
							onclick={() => (view = 'list')}
						>
							<IconLayoutList />
						</Button>
					</div>

					<!-- Every "bring in an existing project" action collapses into this one
				     menu so the primary New-project button stays unambiguous. -->
					{#if onopenfolder || onimport || onimportfolder || onclone}
						<span class="bg-border mx-1 h-4 w-px" aria-hidden="true"></span>
						<DropdownMenu>
							<DropdownMenuTrigger>
								{#snippet child({ props })}
									<Button {...props} variant="ghost">
										<IconFileImport /> Import
										<IconChevronDown class="size-3.5 opacity-60" />
									</Button>
								{/snippet}
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" class="w-56">
								{#if onopenfolder}
									<DropdownMenuItem onclick={() => onopenfolder?.()}>
										<IconFolderOpen class="text-muted-foreground" /> Open folder…
									</DropdownMenuItem>
								{/if}
								{#if onimportfolder}
									<DropdownMenuItem onclick={() => onimportfolder?.()}>
										<IconFolderOpen class="text-muted-foreground" /> Import folder…
									</DropdownMenuItem>
								{/if}
								{#if onimport}
									<DropdownMenuItem onclick={() => onimport?.()}>
										<IconFileImport class="text-muted-foreground" /> Import .zip…
									</DropdownMenuItem>
								{/if}
								{#if onclone}
									<DropdownMenuItem
										onclick={() => {
											cloning = true;
											cloneUrl = '';
										}}
									>
										<IconCloudDownload class="text-muted-foreground" /> Clone repository…
									</DropdownMenuItem>
								{/if}
							</DropdownMenuContent>
						</DropdownMenu>
					{/if}

					<Button onclick={handleCreate}>
						<IconPlus /> New project
					</Button>
				</div>

				{#key scope}
					<!-- Keyed on scope so a rail switch replays the entrance; instant local reads otherwise blink. -->
					<div in:fade={{ duration: ms(180), easing: cubicOut }}>
						{#if loading}
							<!-- Skeletons, not a spinner: only the unknown region is in a loading state. -->
							{#if view === 'list'}
								<div
									class="mt-4 flex flex-col"
									aria-busy="true"
									aria-label="Loading projects"
									role="status"
								>
									{#each { length: 6 } as _, i (i)}
										<div
											class="border-border flex animate-pulse items-center gap-3 border-b py-3 last:border-b-0"
											style:animation-delay={`${i * 70}ms`}
										>
											<div class="bg-muted size-9 shrink-0 rounded-md"></div>
											<div class="flex-1 space-y-1.5">
												<div class="bg-muted h-3 w-1/4 rounded-full"></div>
												<div class="bg-muted h-2.5 w-1/6 rounded-full"></div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div
									class="mt-7 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-5 gap-y-7"
									aria-busy="true"
									aria-label="Loading projects"
									role="status"
								>
									{#each { length: 6 } as _, i (i)}
										<div class="animate-pulse" style:animation-delay={`${i * 70}ms`}>
											<div class="bg-muted aspect-[4/5] rounded-lg"></div>
											<div class="mt-2.5 space-y-1.5 px-0.5">
												<div class="bg-muted h-3 w-3/5 rounded-full"></div>
												<div class="bg-muted h-2.5 w-2/5 rounded-full"></div>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						{:else if filtered.length === 0}
							<div
								class="text-muted-foreground mt-6 flex flex-col items-center gap-3 py-24 text-center"
							>
								<Logo text={false} badge={false} size={36} class="opacity-20" />
								{#if projects.length === 0}
									<p class="text-foreground text-sm font-medium">No projects yet</p>
									<p class="max-w-xs text-xs leading-relaxed">
										Create your first project: everything stays on this device.
									</p>
									<Button class="mt-1" onclick={handleCreate}>
										<IconPlus /> New project
									</Button>
								{:else if query.trim()}
									<p class="text-sm">No projects match “{query}”.</p>
								<Button variant="outline" class="mt-1" onclick={closeSearch}>
									<IconX /> Clear search
								</Button>
								{:else if scope === 'templates'}
									<p class="text-foreground text-sm font-medium">No templates yet</p>
									<p class="max-w-xs text-xs leading-relaxed">
										Starter documents will live here. For now, New project begins from a blank
										article.
									</p>
									<Button variant="outline" class="mt-1" onclick={handleCreate}>
										<IconPlus /> New project
									</Button>
								{:else if scope === 'starred'}
									<p class="text-foreground text-sm font-medium">Nothing starred yet</p>
									<p class="max-w-xs text-xs leading-relaxed">
										Star a project from its ⋯ menu to keep it here.
									</p>
									{#if scopeHrefs?.all}
										<Button variant="outline" class="mt-1" href={scopeHrefs.all}>
											<IconHome /> All projects
										</Button>
									{/if}
								{:else}
									<p class="text-foreground text-sm font-medium">Nothing edited this week</p>
									<p class="max-w-xs text-xs leading-relaxed">
										Recent shows projects you have touched in the last 7 days.
									</p>
									{#if scopeHrefs?.all}
										<Button variant="outline" class="mt-1" href={scopeHrefs.all}>
											<IconHome /> All projects
										</Button>
									{/if}
								{/if}
							</div>
						{:else if view === 'list'}
							<!-- Hairline-separated bands: the divider groups, the fill is left to hover. -->
							<div class="mt-4 flex flex-col" role="list" aria-label="Projects">
								{#each filtered as p, i (p.id)}
									<div
										class="group border-border hover:bg-muted/60 -mx-3 flex items-center gap-3 border-b px-3 py-2.5 transition-colors last:border-b-0"
										role="listitem"
										in:fly={{
											y: 4,
											duration: ms(200),
											delay: ms(Math.min(i, 8) * 14),
											easing: cubicOut
										}}
										out:fade={{ duration: ms(120), easing: cubicOut }}
										animate:flip={{ duration: ms(280), easing: cubicOut }}
									>
										<button
											class="border-border bg-card grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border"
											style:view-transition-name={projectViewTransitionName(p.id)}
											style:view-transition-class="morph-surface"
											onclick={() => onopen?.(p.id)}
											aria-label={`Open ${p.name}`}
										>
											<span class="flex w-full flex-col gap-[3px] px-2" aria-hidden="true">
												<span class="bg-foreground/70 h-[3px] w-3/5 rounded-full"></span>
												<span class="bg-foreground/15 h-[2px] w-full rounded-full"></span>
												<span class="bg-foreground/15 h-[2px] w-4/5 rounded-full"></span>
											</span>
										</button>

										<div class="min-w-0 flex-1">
											{@render projectTitle(p)}
										</div>

										{#if p.starred}
											<span class="shrink-0" title="Starred">
												<IconStarFilled class="text-warning size-3.5" aria-hidden="true" />
												<span class="sr-only">Starred</span>
											</span>
										{/if}
										{@render projectActions(p)}
									</div>
								{/each}
							</div>
						{:else}
							<div
								class="mt-7 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-5 gap-y-7"
								role="list"
								aria-label="Projects"
							>
								{#each filtered as p, i (p.id)}
									<div
										class="group relative"
										role="listitem"
										in:fly={{
											y: 6,
											duration: ms(240),
											delay: ms(Math.min(i, 8) * 15),
											easing: cubicOut
										}}
										out:fade={{ duration: ms(140), easing: cubicOut }}
										animate:flip={{ duration: ms(320), easing: cubicOut }}
									>
										<button
											class="focus-visible:ring-ring block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
											onclick={() => onopen?.(p.id)}
											aria-label={`Open ${p.name}`}
										>
											<div class="relative aspect-[4/5]">
												<!-- Shares its view-transition-name with the editor surface, so opening morphs into it. -->
												<div
													class="bg-card border-border group-hover:border-border-strong ease-craft absolute inset-0 z-10 overflow-hidden rounded-lg border transition-[border-color,transform] duration-200 group-active:scale-[0.98] motion-reduce:transform-none"
													style:view-transition-name={projectViewTransitionName(p.id)}
													style:view-transition-class="morph-surface"
												>
													<!-- folded corner -->
													<div
														class="border-border bg-muted/60 absolute top-0 right-0 size-6 border-b border-l"
														style="clip-path: polygon(100% 0, 0 0, 100% 100%)"
													></div>
													<div class="flex h-full flex-col gap-2 p-5 pt-6">
														<div class="bg-foreground/80 h-2 w-3/5 rounded-full"></div>
														<div class="mt-2 flex flex-col gap-1.5">
															{#each lineWidths(p.id) as w, i (i)}
																<div
																	class="bg-foreground/12 h-1.5 rounded-full"
																	style:width={`${w}%`}
																></div>
															{/each}
														</div>
														<div class="mt-auto flex items-center gap-1.5">
															<span class="bg-primary/70 h-1.5 w-1.5 rounded-full"></span>
															<div class="bg-foreground/12 h-1.5 w-2/5 rounded-full"></div>
														</div>
													</div>
												</div>
											</div>
										</button>

										<div class="mt-2.5 flex items-start justify-between gap-1.5 px-0.5">
											<div class="min-w-0 flex-1">
												{@render projectTitle(p)}
											</div>
											{#if p.starred}
												<span class="mt-0.5 shrink-0" title="Starred">
													<IconStarFilled class="text-warning size-3.5" aria-hidden="true" />
													<span class="sr-only">Starred</span>
												</span>
											{/if}
											{@render projectActions(p)}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/key}
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<AboutDialog bind:open={aboutOpen} {platform} />

<!-- Disk-backed projects show their path: confirming deletes the folder itself. -->
<Dialog open={pendingDelete !== null} onOpenChange={(o) => (o ? null : (pendingDelete = null))}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>Delete “{pendingDelete?.name}”?</DialogTitle>
			<DialogDescription>
				{#if pendingDelete?.root}
					This permanently deletes the project folder and all its files from your disk. This cannot
					be undone.
				{:else}
					This removes the project from GlyphTeX. This cannot be undone.
				{/if}
			</DialogDescription>
		</DialogHeader>
		{#if pendingDelete?.root}
			<p
				class="bg-muted/50 text-muted-foreground truncate rounded-lg px-3 py-2 font-mono text-xs"
				title={pendingDelete.root}
			>
				{pendingDelete.root}
			</p>
		{/if}
		<DialogFooter>
			<Button variant="ghost" size="sm" onclick={() => (pendingDelete = null)}>Cancel</Button>
			<Button variant="destructive" size="sm" onclick={confirmDelete}>
				<IconTrash size={15} /> Delete
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
