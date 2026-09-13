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
		IconArrowRight,
		IconArrowsSort,
		IconClock,
		IconCloudDownload,
		IconCopy,
		IconDotsVertical,
		IconExternalLink,
		IconFileImport,
		IconFileText,
		IconFolder,
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
		IconDatabase,
		IconSettings,
		IconStar,
		IconStarFilled,
		IconTemplate,
		IconTrash,
		IconX
	} from '@tabler/icons-svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import AboutDialog from './about-dialog.svelte';
	import { motionMs as ms } from './motion';
	import { TEMPLATE_CATEGORIES, type ProjectTemplate } from '../../lib/project-templates';

	/** Home screen for every project. The host owns the data and every action; an absent
	 *  handler hides its control (folder actions are desktop-only). */
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
		loading = false,
		templates = [],
		templatesLoading = false,
		onusetemplate
	}: {
		/** Drives the About dialog's platform line and the drop hint. */
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
		/** Clone a Git repository by URL. */
		onclone?: (url: string) => void | Promise<void>;
		onopen?: (id: string) => void;
		onrename?: (id: string, name: string) => void;
		onduplicate?: (id: string) => void;
		ondelete?: (id: string) => void;
		/** Reveal a disk-backed project's folder in the OS file manager (desktop). */
		onreveal?: (id: string) => void;
		/** Open the app settings page (desktop) or storage panel (web). */
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
		/** First read of the project store. The shell renders; the library skeletons. */
		loading?: boolean;
		/** Starter documents for the Templates scope, with their attribution. */
		templates?: ProjectTemplate[];
		/** The catalog chunk is still loading. */
		templatesLoading?: boolean;
		/** Create a project from a template. Return the new id to have the home open it. */
		onusetemplate?: (id: string) => string | void | Promise<string | void>;
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
	let searchEl = $state<HTMLInputElement>();

	// "/" focuses search, except while typing, so it can still go into a project name.
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
		const t = e.target as HTMLElement | null;
		if (t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName ?? '')) return;
		e.preventDefault();
		searchEl?.focus();
	}

	let scrollEl = $state<HTMLElement>();
	let scrolled = $state(false);
	function onScroll() {
		scrolled = (scrollEl?.scrollTop ?? 0) > 4;
	}

	async function handleCreate() {
		const id = await oncreate?.();
		// A host that returns no id navigates on its own.
		if (typeof id !== 'string') return;
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
	const latest = $derived(projects.toSorted((a, b) => b.updatedAt - a.updatedAt).slice(0, 4));

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

	// Active rail row: the base fill, medium weight and a blue icon, so it reads without colour.
	const railRow = 'h-9 rounded-lg px-2.5 text-sm data-active:font-medium data-active:[&>svg]:text-primary';
	const groupLabel = 'text-muted-foreground h-7 px-2.5 text-xs font-medium';

	const scopeLabel = $derived(scopes.find((s) => s.id === scope)?.label ?? 'All projects');
	const ScopeIcon = $derived(scopes.find((s) => s.id === scope)?.icon ?? IconHome);
	const showStart = $derived(scope === 'all' && !loading);
	// Search, sort and view only when there is something to act on; the empty state says the rest.
	const showTools = $derived(loading || query.trim() !== '' || scoped.length > 0);

	let templateQuery = $state('');
	let templateCategory = $state<string>('all');
	let usingTemplate = $state<string | null>(null);

	const templateCounts = $derived.by(() => {
		const acc: Record<string, number> = {};
		for (const t of templates) acc[t.category] = (acc[t.category] ?? 0) + 1;
		return acc;
	});
	const templateTabs = $derived([
		{ id: 'all', label: 'All', count: templates.length },
		...TEMPLATE_CATEGORIES.filter((c) => templateCounts[c.id]).map((c) => ({
			id: c.id as string,
			label: c.label,
			count: templateCounts[c.id]
		}))
	]);
	const visibleTemplates = $derived.by(() => {
		const q = templateQuery.trim().toLowerCase();
		return templates.filter(
			(t) =>
				(templateCategory === 'all' || t.category === templateCategory) &&
				(!q ||
					t.title.toLowerCase().includes(q) ||
					t.description.toLowerCase().includes(q) ||
					t.author.toLowerCase().includes(q))
		);
	});
	const categoryLabel = (id: string) => TEMPLATE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

	async function useTemplate(id: string) {
		if (usingTemplate) return;
		usingTemplate = id;
		try {
			const created = await onusetemplate?.(id);
			if (typeof created === 'string') onopen?.(created);
		} finally {
			usingTemplate = null;
		}
	}

	const sorts: { id: Sort; label: string }[] = [
		{ id: 'newest', label: 'Last edited' },
		{ id: 'oldest', label: 'Oldest edit' },
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

	const meta = (p: Project) =>
		p.root
			? `On disk · edited ${relativeTime(p.updatedAt)}`
			: `${p.files.length} ${p.files.length === 1 ? 'file' : 'files'} · edited ${relativeTime(p.updatedAt)}`;

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

	// Stable per-project line widths so each thumbnail reads as its own page; purely decorative.
	function lineWidths(seed: string, n = 5): number[] {
		let h = 0;
		for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
		return Array.from({ length: n }, (_, i) => {
			h = (h * 1103515245 + 12345) >>> 0;
			return 55 + ((h >> (i + 3)) % 42);
		});
	}
</script>

{#snippet projectTitle(p: Project)}
	{#if renaming === p.id}
		<!-- svelte-ignore a11y_autofocus -->
		<input
			bind:value={renameValue}
			aria-label="Project name"
			class="bg-background border-ring text-foreground h-8 w-full rounded-md border px-2 text-sm font-medium outline-none"
			autofocus
			onkeydown={(e) => {
				if (e.key === 'Enter') commitRename(p.id);
				if (e.key === 'Escape') renaming = null;
			}}
			onblur={() => commitRename(p.id)}
		/>
	{:else}
		<h3 class="text-foreground truncate text-md font-medium">
			<button
				class="focus-visible:ring-ring block max-w-full truncate rounded-sm text-left outline-none after:absolute after:inset-0 focus-visible:ring-2"
				onclick={() => onopen?.(p.id)}
			>
				{p.name}
			</button>
		</h3>
	{/if}
	<p class="text-muted-foreground mt-0.5 truncate text-xs" title={p.root}>{meta(p)}</p>
{/snippet}

{#snippet starBadge(p: Project)}
	{#if p.starred}
		<span class="relative z-10 shrink-0" title="Starred">
			<IconStarFilled class="text-warning size-4" aria-hidden="true" />
			<span class="sr-only">Starred</span>
		</span>
	{/if}
{/snippet}

{#snippet projectActions(p: Project)}
	<DropdownMenu>
		<DropdownMenuTrigger>
			{#snippet child({ props })}
				<button
					{...props}
					class="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring relative z-10 grid size-8 shrink-0 place-items-center rounded-md outline-none transition-[opacity,color,background-color] duration-200 ease-craft focus-visible:opacity-100 focus-visible:ring-2 data-[state=open]:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
					aria-label={`Actions for ${p.name}`}
				>
					<IconDotsVertical size={16} />
				</button>
			{/snippet}
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end" class="w-52">
			{#if onstar}
				<DropdownMenuItem onclick={() => onstar?.(p.id, !p.starred)}>
					{#if p.starred}
						<IconStarFilled class="text-warning" /> Unstar
					{:else}
						<IconStar /> Star
					{/if}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
			{/if}
			<DropdownMenuItem onclick={() => startRename(p)}>
				<IconPencil /> Rename
			</DropdownMenuItem>
			<DropdownMenuItem onclick={() => onduplicate?.(p.id)}>
				<IconCopy /> Duplicate
			</DropdownMenuItem>
			{#if onreveal && p.root}
				<DropdownMenuItem onclick={() => onreveal?.(p.id)} class="whitespace-nowrap">
					<IconFolderShare /> Reveal in file manager
				</DropdownMenuItem>
			{/if}
			<DropdownMenuSeparator />
			<DropdownMenuItem variant="destructive" onclick={() => (pendingDelete = p)}>
				<IconTrash /> Delete
			</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
{/snippet}

{#snippet pageThumb(p: Project, compact = false)}
	<!-- Shares its view-transition-name with the editor surface, so opening morphs into it. -->
	<div
		class="bg-card border-border relative overflow-hidden rounded-md border {compact
			? 'size-10'
			: 'absolute inset-x-6 top-5 bottom-0 rounded-b-none border-b-0'}"
		style:view-transition-name={projectViewTransitionName(p.id)}
		style:view-transition-class="morph-surface"
		aria-hidden="true"
	>
		{#if compact}
			<span class="flex h-full flex-col justify-center gap-[3px] px-2">
				<span class="bg-foreground h-[3px] w-3/5 rounded-full"></span>
				<span class="bg-border-strong h-[2px] w-full rounded-full"></span>
				<span class="bg-border-strong h-[2px] w-4/5 rounded-full"></span>
			</span>
		{:else}
			<div class="flex flex-col gap-2 p-4">
				<div class="bg-foreground h-1.5 w-1/2 rounded-full"></div>
				<div class="mt-1.5 flex flex-col gap-1.5">
					{#each lineWidths(p.id) as w, i (i)}
						<div class="bg-border-strong h-1 rounded-full" style:width={`${w}%`}></div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/snippet}

<svelte:window onkeydown={onWindowKeydown} />

<a
	href="#main"
	class="bg-background text-foreground ring-ring sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-2"
>
	Skip to projects
</a>
<Sidebar.Provider class="bg-canvas text-foreground h-dvh min-h-0">
	<Sidebar.Root variant="sidebar" collapsible="icon" class="border-transparent">
		<Sidebar.Header class="h-14 justify-center px-2">
			<a
				href={platform === 'web' ? '/' : '/workspace'}
				class="hover:bg-sidebar-accent focus-visible:ring-ring flex h-9 items-center gap-2 rounded-lg px-2 outline-none transition-colors focus-visible:ring-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:self-center group-data-[collapsible=icon]:px-0"
			>
				<Logo
					size={22}
					badge
					viewTransitionName="app-logo"
					class="text-md font-semibold group-data-[collapsible=icon]:[&>span:last-child]:hidden"
				/>
			</a>
		</Sidebar.Header>

		<Sidebar.Content class="gap-2">
			<Sidebar.Group class="px-2 py-0">
				<Sidebar.GroupLabel class="{groupLabel} group-data-[collapsible=icon]:hidden">
					Library
				</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu aria-label="Project scopes" class="gap-0.5">
						{#each scopes as item (item.id)}
							{@const Icon = item.icon}
							{@const href = scopeHrefs?.[item.id]}
							{#if href}
								{@const count =
									item.id === 'all'
										? projects.length
										: item.id === 'recent'
											? recent.length
											: item.id === 'starred'
												? starred.length
												: templates.length}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton
										isActive={activeScope === item.id}
										class={railRow}
										tooltipContent={item.label}
									>
										{#snippet child({ props })}
											<a {href} {...props} aria-current={activeScope === item.id ? 'page' : undefined}>
												<Icon /><span>{item.label}</span>
												{#if count > 0 && !loading}
													<span
														class="text-muted-foreground ml-auto text-xs tabular-nums group-data-[collapsible=icon]:hidden"
														>{count}</span
													>
												{/if}
											</a>
										{/snippet}
									</Sidebar.MenuButton>
								</Sidebar.MenuItem>
							{/if}
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>

			<Sidebar.Group class="mt-auto px-2 py-0">
				<Sidebar.GroupContent>
					<Sidebar.Menu class="gap-0.5">
						{#if onsettings}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									class={railRow}
									tooltipContent={platform === 'web' ? 'Storage' : 'Settings'}
									onclick={() => onsettings?.()}
								>
									{#if platform === 'web'}<IconDatabase /><span>Storage</span>{:else}<IconSettings /><span>Settings</span>{/if}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/if}
						{#if helpHref}
							<Sidebar.MenuItem>
								<!-- The trailing external icon marks a row that leaves the workspace. -->
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

		{#if storage}
			<Sidebar.Footer class="p-2 group-data-[collapsible=icon]:hidden">
				<!-- Warning past 80%: the browser starts evicting under storage pressure. -->
				{@const tight = storagePct >= 80}
				<div class="border-border bg-card rounded-xl border p-3">
					<div class="flex items-center justify-between gap-2 text-xs">
						<span class="text-foreground font-medium">Local storage</span>
						<span class="text-muted-foreground tabular-nums">
							{formatBytes(storage.used)} / {formatBytes(storage.total)}
						</span>
					</div>
					<div
						class="bg-muted mt-2 h-1.5 overflow-hidden rounded-full"
						role="progressbar"
						aria-label="Local storage used"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(storagePct)}
					>
						<div
							class="h-full rounded-full transition-[width] duration-500 ease-craft {tight
								? 'bg-warning'
								: 'bg-primary'}"
							style:width={`${Math.max(storagePct, 2)}%`}
						></div>
					</div>
					{#if tight}
						<p class="text-warning mt-2 text-xs font-medium">Nearly full. The browser may clear it.</p>
					{/if}
				</div>
			</Sidebar.Footer>
		{/if}

		<Sidebar.Rail />
	</Sidebar.Root>

	<!-- Sidebar.Inset renders the page's one <main>; the id is the skip link's target. -->
	<Sidebar.Inset
		id="main"
		tabindex={-1}
		class="workspace-card border-border min-h-0 overflow-hidden outline-none md:my-2 md:mr-2 md:rounded-xl md:border dark:border-border-strong"
	>
		<div bind:this={scrollEl} onscroll={onScroll} class="min-h-0 min-w-0 flex-1 overflow-auto">
			<header
				class="bg-background/95 sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-3 backdrop-blur-sm transition-colors duration-200 sm:px-4 {scrolled
					? 'border-border'
					: 'border-transparent'}"
			>
				<Sidebar.Trigger class="size-9" title="Toggle sidebar (Ctrl/⌘ B)" />
				<span class="bg-border h-5 w-px" aria-hidden="true"></span>
				<ScopeIcon size={16} class="text-muted-foreground ml-1 shrink-0" aria-hidden="true" />
				<span class="text-foreground truncate text-md font-medium">{scopeLabel}</span>
				<div class="ml-auto flex items-center gap-1">
					<ThemeToggle size="icon" />
				</div>
			</header>

			<div class="mx-auto w-full max-w-6xl px-4 pt-8 pb-20 sm:px-8 lg:px-12">
				{#if showStart}
					<div class="flex flex-col gap-1">
						<h1 class="text-heading-sm md:text-heading text-foreground font-medium">
							{projects.length === 0 ? 'Start your first document' : 'Your documents'}
						</h1>
						<p class="text-muted-foreground text-body">
							{platform === 'web'
								? 'Projects live in this browser and compile on this device.'
								: 'Projects live in folders on this computer and compile locally.'}
						</p>
					</div>

					<div
						class="mt-6 grid gap-3 {projects.length > 0 ? 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]' : ''}"
					>
						<section
							aria-labelledby="start-title"
							class="border-border-strong bg-card flex flex-col gap-5 rounded-2xl border border-dashed p-5 sm:p-6"
						>
							<div class="flex items-start gap-4">
								<span
									class="bg-primary text-primary-foreground grid size-12 shrink-0 place-items-center rounded-xl"
									aria-hidden="true"
								>
									<IconFileText size={24} />
								</span>
								<div class="min-w-0">
									<h2 id="start-title" class="text-body-lg text-foreground font-medium">
										New LaTeX project
									</h2>
									<p class="text-muted-foreground text-body mt-0.5">
										Opens a blank article with a sections folder.
										{platform === 'web' ? 'Or drop a folder or .zip anywhere on this page.' : ''}
									</p>
								</div>
							</div>

							<div class="flex flex-wrap items-center gap-2">
								<Button variant="primary" onclick={handleCreate}>
									<IconPlus /> New project
								</Button>
								{#if onimport}
									<Button variant="outline" onclick={() => onimport?.()}>
										<IconFileImport /> Import .zip
									</Button>
								{/if}
								{#if onimportfolder}
									<Button variant="outline" onclick={() => onimportfolder?.()}>
										<IconFolderOpen /> Import folder
									</Button>
								{/if}
								{#if onopenfolder}
									<Button variant="outline" onclick={() => onopenfolder?.()}>
										<IconFolderOpen /> Open folder
									</Button>
								{/if}
								{#if onclone && !cloning}
									<Button
										variant="ghost"
										onclick={() => {
											cloning = true;
											cloneUrl = '';
										}}
									>
										<IconCloudDownload /> Clone repository
									</Button>
								{/if}
								{#if onusetemplate && scopeHrefs?.templates}
									<Button variant="ghost" href={scopeHrefs.templates}>
										<IconTemplate /> Start from a template
									</Button>
								{/if}
							</div>

							{#if onclone && cloning}
								<div class="flex flex-col gap-2 sm:flex-row">
									<label class="sr-only" for="clone-url">Repository URL</label>
									<!-- svelte-ignore a11y_autofocus -->
									<input
										id="clone-url"
										bind:value={cloneUrl}
										class="bg-background border-border text-foreground placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-ring h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none focus-visible:ring-2"
										placeholder="https://github.com/owner/repo.git"
										spellcheck="false"
										autofocus
										disabled={cloneBusy}
										onkeydown={(e) => {
											if (e.key === 'Enter') submitClone();
											if (e.key === 'Escape') cloning = false;
										}}
									/>
									<div class="flex gap-2">
										<Button disabled={cloneBusy || !cloneUrl.trim()} onclick={submitClone}>
											{cloneBusy ? 'Cloning…' : 'Clone'}
										</Button>
										<Button variant="ghost" disabled={cloneBusy} onclick={() => (cloning = false)}>
											Cancel
										</Button>
									</div>
								</div>
							{/if}
						</section>

						{#if projects.length > 0}
							<section
								aria-labelledby="recent-title"
								class="border-border bg-card flex flex-col rounded-2xl border p-2"
							>
								<h2
									id="recent-title"
									class="text-muted-foreground px-3 pt-2 pb-1 text-xs font-medium"
								>
									Jump back in
								</h2>
								<ul class="flex flex-col">
									{#each latest as p (p.id)}
										<li>
											<button
												class="group hover:bg-muted focus-visible:ring-ring flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset"
												onclick={() => onopen?.(p.id)}
											>
												<span
													class="border-border text-muted-foreground group-hover:text-primary grid size-9 shrink-0 place-items-center rounded-lg border transition-colors"
													aria-hidden="true"
												>
													{#if p.root}<IconFolder size={18} />{:else}<IconFileText size={18} />{/if}
												</span>
												<span class="min-w-0 flex-1">
													<span class="text-foreground block truncate text-md font-medium">{p.name}</span>
													<span class="text-muted-foreground block truncate text-xs">{meta(p)}</span>
												</span>
												{@render starBadge(p)}
												<IconArrowRight
													size={16}
													class="text-muted-foreground shrink-0 transition-transform duration-200 ease-craft group-hover:translate-x-0.5"
													aria-hidden="true"
												/>
											</button>
										</li>
									{/each}
								</ul>
							</section>
						{/if}
					</div>
				{:else}
					<h1 class="text-heading-sm md:text-heading text-foreground font-medium">{scopeLabel}</h1>
					<p class="text-muted-foreground text-body mt-1">
						{scope === 'recent'
							? 'Projects you edited in the last 7 days.'
							: scope === 'starred'
								? 'Projects you starred from their menu.'
								: scope === 'templates'
									? 'Starter documents to begin from.'
									: ''}
					</p>
				{/if}

				{#if scope === 'templates' && templatesLoading}
					<div class="mt-6 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3" aria-busy="true" aria-label="Loading templates" role="status">
						{#each { length: 8 } as _, i (i)}
							<div class="border-border flex animate-pulse flex-col gap-3 rounded-2xl border p-4" style:animation-delay={`ms`}>
								<div class="bg-muted h-3 w-1/3 rounded-full"></div>
								<div class="bg-muted h-4 w-4/5 rounded-full"></div>
								<div class="bg-muted h-3 w-full rounded-full"></div>
								<div class="bg-muted h-10 w-full rounded-lg"></div>
							</div>
						{/each}
					</div>
				{:else if scope === 'templates' && templates.length > 0}
					<section aria-label="Template gallery" class="mt-6">
						<div class="flex flex-col gap-3 lg:flex-row lg:items-center">
							<div class="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1" role="group" aria-label="Filter templates by use">
								{#each templateTabs as tab (tab.id)}
									{@const active = templateCategory === tab.id}
									<button
										class="focus-visible:ring-ring flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 {active
											? 'border-border bg-card text-foreground font-medium shadow-xs'
											: 'text-muted-foreground hover:bg-muted hover:text-foreground border-transparent'}"
										aria-pressed={active}
										onclick={() => (templateCategory = tab.id)}
									>
										{tab.label}
										<span class="text-muted-foreground text-xs tabular-nums">{tab.count}</span>
									</button>
								{/each}
							</div>
							<div class="relative w-full lg:w-64">
								<IconSearch size={16} class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" aria-hidden="true" />
								<input
									bind:value={templateQuery}
									type="search"
									class="bg-background border-border text-foreground placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-ring h-10 w-full rounded-lg border py-1 pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
									placeholder="Search templates"
									spellcheck="false"
									aria-label="Search templates"
								/>
							</div>
						</div>

						<p class="text-muted-foreground mt-4 text-sm" aria-live="polite">
							{visibleTemplates.length} {visibleTemplates.length === 1 ? 'template' : 'templates'} · each keeps its author's licence and credit
						</p>

						{#if visibleTemplates.length === 0}
							<div class="border-border-strong mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
								<p class="text-foreground text-md font-medium">No templates match “{templateQuery}”</p>
								<Button variant="outline" onclick={() => { templateQuery = ''; templateCategory = 'all'; }}>
									<IconX /> Clear filters
								</Button>
							</div>
						{:else}
							<ul class="mt-4 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3" aria-label="Templates">
								{#each visibleTemplates as t (t.id)}
									<li class="border-border bg-card hover:border-border-strong flex flex-col gap-3 rounded-2xl border p-4 transition-[border-color] duration-200 ease-craft">
										<div class="flex items-center justify-between gap-2">
											<span class="text-muted-foreground text-xs font-medium">{categoryLabel(t.category)}</span>
											<span class="border-border text-muted-foreground rounded-md border px-1.5 py-0.5 font-mono text-xs">{t.documentClass}</span>
										</div>
										<div class="min-w-0 flex-1">
											<h3 class="text-foreground line-clamp-2 text-md font-medium">{t.title}</h3>
											{#if t.description}
												<p class="text-muted-foreground mt-1 line-clamp-3 text-sm">{t.description}</p>
											{/if}
										</div>
										<p class="text-muted-foreground truncate text-xs" title={`${t.author} · ${t.license}`}>
											by <span class="text-foreground">{t.author}</span> · {t.license.replace('Creative Commons ', '')}
										</p>
										<div class="flex items-center gap-2">
											<Button
												variant="outline"
												class="flex-1"
												disabled={usingTemplate !== null}
												onclick={() => useTemplate(t.id)}
											>
												{usingTemplate === t.id ? 'Creating…' : 'Use template'}
											</Button>
											<Button
												href={t.sourceUrl}
												target="_blank"
												rel="noopener noreferrer"
												variant="ghost"
												size="icon"
												aria-label={`Original source of ${t.title}`}
												title="Original source"
											>
												<IconExternalLink />
											</Button>
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</section>
				{:else if projects.length > 0 || loading || scope !== 'all'}
					<section
						aria-label={scope === 'all' ? 'All projects' : scopeLabel}
						class={scope === 'all' ? 'mt-10' : 'mt-6'}
					>
						<div class="flex flex-wrap items-center gap-2">
							<div class="mr-auto flex items-baseline gap-2">
								{#if scope === 'all'}
									<h2 class="text-body-lg text-foreground font-medium">All projects</h2>
								{/if}
								<span class="text-muted-foreground text-sm tabular-nums" aria-live="polite">
									{#if loading}
										Reading local storage…
									{:else if query.trim()}
										{filtered.length} of {scoped.length}
									{:else if scope !== 'all'}
										{scoped.length}
										{scoped.length === 1 ? 'project' : 'projects'}
									{:else}
										{scoped.length}
									{/if}
								</span>
							</div>

							{#if showTools}
							<div class="relative w-full sm:w-64">
								<IconSearch
									size={16}
									class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
									aria-hidden="true"
								/>
								<input
									bind:this={searchEl}
									bind:value={query}
									type="search"
									class="bg-background border-border text-foreground placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-ring h-10 w-full rounded-lg border py-1 pr-9 pl-9 text-sm outline-none focus-visible:ring-2 [&::-webkit-search-cancel-button]:hidden"
									placeholder="Search projects"
									spellcheck="false"
									aria-label="Search projects"
									onkeydown={(e) => {
										if (e.key === 'Escape') query = '';
									}}
								/>
								{#if query}
									<button
										class="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md outline-none focus-visible:ring-2"
										onclick={() => (query = '')}
										aria-label="Clear search"
									>
										<IconX size={14} />
									</button>
								{:else}
									<kbd
										class="border-border text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border px-1.5 font-mono text-xs"
										aria-hidden="true">/</kbd
									>
								{/if}
							</div>

							<DropdownMenu>
								<DropdownMenuTrigger>
									{#snippet child({ props })}
										<Button {...props} variant="outline" class="px-3" aria-label="Sort projects">
											<IconArrowsSort />
											<span class="hidden md:inline">{sorts.find((o) => o.id === sort)?.label}</span>
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

							<div
								class="bg-muted flex h-10 items-center gap-0.5 rounded-lg p-1"
								role="group"
								aria-label="View mode"
							>
								{#each [{ id: 'grid', label: 'Grid view', icon: IconLayoutGrid }, { id: 'list', label: 'List view', icon: IconLayoutList }] as const as mode (mode.id)}
									<button
										class="focus-visible:ring-ring grid size-8 place-items-center rounded-md outline-none transition-[color,background-color,box-shadow] duration-200 ease-craft focus-visible:ring-2 focus-visible:ring-inset {view ===
										mode.id
											? 'bg-card text-foreground shadow-xs'
											: 'text-muted-foreground hover:text-foreground'}"
										aria-label={mode.label}
										aria-pressed={view === mode.id}
										title={mode.label}
										onclick={() => (view = mode.id)}
									>
										<mode.icon size={16} />
									</button>
								{/each}
							</div>

							{#if !showStart && scope !== 'templates'}
								<Button onclick={handleCreate}>
									<IconPlus /> New project
								</Button>
							{/if}
							{/if}
						</div>

						{#key scope}
							<div in:fade={{ duration: ms(180), easing: cubicOut }}>
								{#if loading}
									<div
										class="mt-5 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3"
										aria-busy="true"
										aria-label="Loading projects"
										role="status"
									>
										{#each { length: 6 } as _, i (i)}
											<div
												class="border-border animate-pulse rounded-2xl border p-2"
												style:animation-delay={`${i * 70}ms`}
											>
												<div class="bg-muted aspect-[4/3] rounded-xl"></div>
												<div class="space-y-1.5 p-2 pt-3">
													<div class="bg-muted h-3 w-3/5 rounded-full"></div>
													<div class="bg-muted h-2.5 w-2/5 rounded-full"></div>
												</div>
											</div>
										{/each}
									</div>
								{:else if filtered.length === 0}
									<div
										class="border-border-strong mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center"
									>
										<span
											class="border-border text-muted-foreground grid size-12 place-items-center rounded-xl border"
											aria-hidden="true"
										>
											{#if query.trim()}<IconSearch size={22} />{:else if scope === 'starred'}<IconStar
													size={22}
												/>{:else if scope === 'templates'}<IconTemplate size={22} />{:else}<IconClock
													size={22}
												/>{/if}
										</span>
										{#if query.trim()}
											<p class="text-foreground text-md font-medium">No projects match “{query}”</p>
											<Button variant="outline" onclick={() => (query = '')}>
												<IconX /> Clear search
											</Button>
										{:else if scope === 'templates'}
											<p class="text-foreground text-md font-medium">No templates yet</p>
											<p class="text-muted-foreground max-w-sm text-sm">
												Starter documents will live here. For now, a new project begins from a blank
												article.
											</p>
											<Button variant="outline" onclick={handleCreate}>
												<IconPlus /> New project
											</Button>
										{:else if scope === 'starred'}
											<p class="text-foreground text-md font-medium">Nothing starred yet</p>
											<p class="text-muted-foreground max-w-sm text-sm">
												Star a project from its menu to keep it here.
											</p>
											{#if scopeHrefs?.all}
												<Button variant="outline" href={scopeHrefs.all}>
													<IconHome /> All projects
												</Button>
											{/if}
										{:else}
											<p class="text-foreground text-md font-medium">Nothing edited this week</p>
											<p class="text-muted-foreground max-w-sm text-sm">
												Recent shows projects you touched in the last 7 days.
											</p>
											{#if scopeHrefs?.all}
												<Button variant="outline" href={scopeHrefs.all}>
													<IconHome /> All projects
												</Button>
											{/if}
										{/if}
									</div>
								{:else if view === 'list'}
									<ul
										class="border-border bg-card mt-5 flex flex-col overflow-hidden rounded-2xl border"
										aria-label="Projects"
									>
										{#each filtered as p, i (p.id)}
											<li
												class="group hover:bg-muted relative flex min-h-16 items-center gap-3 border-b px-4 py-2.5 transition-colors last:border-b-0"
												in:fly={{ y: 4, duration: ms(200), delay: ms(Math.min(i, 8) * 14), easing: cubicOut }}
												out:fade={{ duration: ms(120), easing: cubicOut }}
												animate:flip={{ duration: ms(280), easing: cubicOut }}
											>
												{@render pageThumb(p, true)}
												<div class="min-w-0 flex-1">
													{@render projectTitle(p)}
												</div>
												{@render starBadge(p)}
												{@render projectActions(p)}
											</li>
										{/each}
									</ul>
								{:else}
									<ul
										class="mt-5 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3"
										aria-label="Projects"
									>
										{#each filtered as p, i (p.id)}
											<li
												class="group border-border bg-card hover:border-border-strong relative flex flex-col rounded-2xl border p-2 transition-[border-color] duration-200 ease-craft"
												in:fly={{ y: 6, duration: ms(240), delay: ms(Math.min(i, 8) * 15), easing: cubicOut }}
												out:fade={{ duration: ms(140), easing: cubicOut }}
												animate:flip={{ duration: ms(320), easing: cubicOut }}
											>
												<div class="bg-muted relative aspect-[4/3] overflow-hidden rounded-xl">
													{@render pageThumb(p)}
												</div>
												<div class="flex items-start gap-1.5 px-2 pt-3 pb-1">
													<div class="min-w-0 flex-1">
														{@render projectTitle(p)}
													</div>
													{@render starBadge(p)}
													{@render projectActions(p)}
												</div>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						{/key}
					</section>
				{/if}
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
				class="bg-muted text-muted-foreground truncate rounded-lg px-3 py-2 font-mono text-xs"
				title={pendingDelete.root}
			>
				{pendingDelete.root}
			</p>
		{/if}
		<DialogFooter>
			<Button variant="ghost" onclick={() => (pendingDelete = null)}>Cancel</Button>
			<Button variant="destructive" onclick={confirmDelete}>
				<IconTrash /> Delete
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
