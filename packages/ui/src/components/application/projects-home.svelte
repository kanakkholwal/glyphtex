<script lang="ts" module>
	import type { Project } from '@glyphtex/ui/projects';
	export type { Project };

	/** A rail destination. Each one is a real route when the host supplies hrefs. */
	export type Scope = 'all' | 'recent' | 'starred' | 'templates';
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
	  IconCloud,
	  IconDotsVertical,
	  IconExternalLink,
	  IconFileImport,
	  IconFolderOpen,
	  IconFolderShare,
	  IconHelpCircle,
	  IconInfoCircle,
	  IconHome,
	  IconLayoutGrid,
	  IconLayoutList,
	  IconPencil,
	  IconPlus,
	  IconSearch,
	  IconSettings,
	  IconStar,
	  IconStarFilled,
	  IconTemplate,
	  IconTrash
	} from '@tabler/icons-svelte';
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import AboutDialog from './about-dialog.svelte';

	/** Home screen listing every project as a card. The host owns the data and every
	 *  action; an absent handler hides its control (folder actions are desktop-only). */
	let {
		platform = 'desktop',
		projects = [],
		oncreate,
		onopenfolder,
		onimport,
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
		/** Create a project. May return the new id; if so, the home reveals the new
		 *  card and *then* opens it (a clean morph), instead of navigating instantly. */
		oncreate?: () => string | void | Promise<string | void>;
		/** Open an existing project folder from disk (desktop). */
		onopenfolder?: () => void;
		/** Import a .zip project (desktop). */
		onimport?: () => void;
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
		/** Route per destination. A scope with no href is not offered at all — a host
		 *  that cannot back one (no starring on desktop yet) simply omits it. */
		scopeHrefs?: Partial<Record<Scope, string>>;
		/** First read of the project store. The shell renders; the grid skeletons. */
		loading?: boolean;
	} = $props();

	type Sort = 'newest' | 'oldest' | 'name';

	const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

	const scope = $derived(activeScope);
	let sort = $state<Sort>('newest');
	let dense = $state(false);
	let query = $state('');
	let renaming = $state<string | null>(null);
	let renameValue = $state('');
	let aboutOpen = $state(false);
	let pendingDelete = $state<Project | null>(null);

	let scrollEl = $state<HTMLElement>();
	let scrolled = $state(false);
	function onScroll() {
		scrolled = (scrollEl?.scrollTop ?? 0) > 4;
	}

	// Just longer than the new card's 360ms `in:fly`, so the card→editor view
	// transition morphs from a settled card rather than one mid-entrance.
	const NEW_CARD_REVEAL_MS = 400;
	async function handleCreate() {
		const id = await oncreate?.();
		// A host that returns no id navigates on its own (legacy) — nothing to do.
		if (typeof id !== 'string') return;
		await tick(); // flush the inserted card into the DOM so its entrance starts
		await new Promise((resolve) => setTimeout(resolve, NEW_CARD_REVEAL_MS));
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
		{ id: 'all', label: 'Workspace', icon: IconHome },
		{ id: 'recent', label: 'Recent', icon: IconClock },
		{ id: 'starred', label: 'Starred', icon: IconStar },
		{ id: 'templates', label: 'Templates', icon: IconTemplate }
	];

	// Overrides on SidebarMenuButton: taller rows, 18px icons, and a brand-tinted
	// active state instead of the default neutral accent fill.
	const navRow =
		'h-10 rounded-lg px-3 text-md data-active:bg-brand-subtle data-active:text-brand [&_svg]:size-[1.125rem]';
	/** Footer rows never take an active state — they are actions, not locations. */
	const actionRow = `${navRow} text-muted-foreground hover:text-foreground`;

	const sorts: { id: Sort; label: string }[] = [
		{ id: 'newest', label: 'Newest first' },
		{ id: 'oldest', label: 'Oldest first' },
		{ id: 'name', label: 'Name (A–Z)' }
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
			return 55 + ((h >> (i + 3)) % 42); // 55–96%
		});
	}

</script>

<Sidebar.Provider class="text-foreground h-dvh min-h-0">
	<Sidebar.Root variant="inset" collapsible="icon">
		<Sidebar.Header class="h-14 justify-center px-3 group-data-[collapsible=icon]:px-0">
			<Logo
				size={28}
				badge
				viewTransitionName="app-logo"
				class="text-base tracking-tight group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>span:last-child]:hidden"
			/>
		</Sidebar.Header>

		<Sidebar.Content>
			<Sidebar.Group class="px-2 py-1">
				<Sidebar.GroupContent>
					<Sidebar.Menu aria-label="Project scopes">
						{#each scopes as item (item.id)}
							{@const Icon = item.icon}
							{@const href = scopeHrefs?.[item.id]}
							{#if href}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton
										isActive={activeScope === item.id}
										class={navRow}
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
		</Sidebar.Content>

		<Sidebar.Footer class="gap-3">
			<Sidebar.Separator class="mx-1" />

			<Sidebar.Menu>
				{#if onsettings}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							class={actionRow}
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
						<Sidebar.MenuButton class={actionRow} tooltipContent={'Help & Docs'}>
							{#snippet child({ props })}
								<a {...props} href={helpHref}>
									<IconHelpCircle /><span>Help &amp; Docs</span>
									<IconExternalLink
										class="text-faint ml-auto !size-3.5 group-data-[collapsible=icon]:hidden"
									/>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/if}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						class={actionRow}
						tooltipContent="About GlyphTeX"
						onclick={() => (aboutOpen = true)}
					>
						<IconInfoCircle /><span>About GlyphTeX</span>
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>

			{#if storage}
				<!-- Amber past 80%: the browser starts evicting under storage pressure. -->
				{@const tight = storagePct >= 80}
				<div
					class="border-sidebar-border bg-card rounded-xl border p-3 group-data-[collapsible=icon]:hidden"
				>
					<div class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
						<IconCloud size={16} class="shrink-0" /> Local storage
					</div>
					<div class="bg-muted mt-2.5 h-1.5 overflow-hidden rounded-full">
						<div
							class="h-full rounded-full transition-[width] duration-500 {tight
								? 'bg-warning'
								: 'bg-brand'}"
							style:width={`${Math.max(storagePct, 2)}%`}
						></div>
					</div>
					<p class="text-faint mt-2 text-xs">
						{formatBytes(storage.used)} of {formatBytes(storage.total)} used
					</p>
				</div>
			{/if}
		</Sidebar.Footer>
	</Sidebar.Root>

	<!-- `bg-card`, not the inset's default `bg-background`: in dark this panel is
	     the layer that lifts off the rail's floor. -->
	<Sidebar.Inset class="bg-card min-h-0 overflow-hidden">
		<div bind:this={scrollEl} onscroll={onScroll} class="min-h-0 min-w-0 flex-1 overflow-auto">
		<header
			class="ease-craft sticky top-0 z-20 flex h-14 items-center justify-end gap-3 border-b px-6 transition-[background-color,border-color,box-shadow] duration-300 {scrolled
				? 'border-border bg-card/75 shadow-craft-sm backdrop-blur-xl'
				: 'border-transparent bg-transparent'}"
		>
			<div class="-ml-2 flex items-center gap-1">
				<Sidebar.Trigger title="Toggle sidebar (Ctrl/⌘ B)" />
				<Logo size={24} class="text-sm tracking-tight md:hidden" />
			</div>
			<div class="flex flex-1 items-center justify-end gap-0.5">
				<ThemeToggle size="icon-sm" />
				<Button
					size="icon-sm"
					variant="ghost"
					title="About GlyphTeX"
					aria-label="About GlyphTeX"
					onclick={() => (aboutOpen = true)}
				>
					<IconInfoCircle />
				</Button>
			</div>
		</header>

		<div class="mx-auto w-full max-w-[1140px] px-6 pt-6 pb-12">
			<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
				<div>
					<h1 class="font-display text-2xl font-semibold tracking-tight">Your projects</h1>
					<p class="text-muted-foreground mt-1.5 text-sm">
						{#if loading}
							Reading local storage…
						{:else}
							{projects.length}
							{projects.length === 1 ? 'project' : 'projects'} · stored on this device
						{/if}
					</p>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<!-- Every "bring in an existing project" action collapses into this one
					     menu so the primary New-project button stays unambiguous. -->
					{#if onopenfolder || onimport || onclone}
						<DropdownMenu>
							<DropdownMenuTrigger>
								{#snippet child({ props })}
									<Button {...props} size="sm" variant="outline">
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
					<Button size="sm" onclick={handleCreate}>
						<IconPlus /> New project
					</Button>
				</div>
			</div>

			{#if onclone && cloning}
				<div
					class="border-border bg-card shadow-craft-sm mt-4 flex items-center gap-2 rounded-xl border p-2"
				>
					<IconCloudDownload size={16} class="text-muted-foreground ml-1 shrink-0" />
					<!-- svelte-ignore a11y_autofocus -->
					<input
						bind:value={cloneUrl}
						class="text-foreground placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
						placeholder="Repository URL — https://github.com/owner/repo.git"
						spellcheck="false"
						autofocus
						disabled={cloneBusy}
						onkeydown={(e) => {
							if (e.key === 'Enter') submitClone();
							if (e.key === 'Escape') cloning = false;
						}}
					/>
					<Button size="sm" disabled={cloneBusy || !cloneUrl.trim()} onclick={submitClone}>
						{cloneBusy ? 'Cloning…' : 'Clone'}
					</Button>
					<Button size="sm" variant="ghost" disabled={cloneBusy} onclick={() => (cloning = false)}>
						Cancel
					</Button>
				</div>
			{/if}

			<div class="mt-6 flex flex-wrap items-center gap-2">
				<div class="relative min-w-56 flex-1">
					<IconSearch
						size={16}
						class="text-faint pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
					/>
					<input
						bind:value={query}
						class="bg-card border-border text-foreground placeholder:text-faint focus-visible:border-ring focus-visible:ring-ring/30 ease-craft h-10 w-full rounded-xl border py-2 pr-3 pl-9 text-sm outline-none transition-[box-shadow,border-color] duration-200 focus-visible:ring-2"
						placeholder="Search projects…"
						spellcheck="false"
						aria-label="Search projects"
					/>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger>
						{#snippet child({ props })}
							<Button {...props} variant="outline" size="sm" class="h-10 gap-1.5">
								<IconArrowsSort />
								{sorts.find((s) => s.id === sort)?.label}
								<IconChevronDown class="size-3.5 opacity-60" />
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

				<div class="border-border flex h-10 items-center gap-0.5 rounded-xl border p-1">
					<Button
						variant={dense ? 'ghost' : 'secondary'}
						size="icon-sm"
						title="Comfortable grid"
						aria-label="Comfortable grid"
						aria-pressed={!dense}
						onclick={() => (dense = false)}
					>
						<IconLayoutGrid />
					</Button>
					<Button
						variant={dense ? 'secondary' : 'ghost'}
						size="icon-sm"
						title="Dense grid"
						aria-label="Dense grid"
						aria-pressed={dense}
						onclick={() => (dense = true)}
					>
						<IconLayoutList />
					</Button>
				</div>
			</div>

			{#key scope}
			<!-- Keyed on scope so switching rails replays the entrance rather than
			     swapping content in place; local reads are instant, so without it the
			     grid just blinks. -->
			<div in:fade={{ duration: 180, easing: cubicOut }}>
			{#if loading}
				<!-- Skeletons, not a full-page spinner: the rail and toolbar are already
				     correct, so only the unknown region should be in a loading state. -->
				<div
					class="mt-7 grid gap-x-5 gap-y-7 {dense
						? 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]'
						: 'grid-cols-[repeat(auto-fill,minmax(190px,1fr))]'}"
					aria-busy="true"
					aria-label="Loading projects"
					role="status"
				>
					{#each { length: 6 } as _, i (i)}
						<div class="animate-pulse" style:animation-delay={`${i * 70}ms`}>
							<div class="bg-muted aspect-[4/5] rounded-xl"></div>
							<div class="mt-2.5 space-y-1.5 px-0.5">
								<div class="bg-muted h-3 w-3/5 rounded-full"></div>
								<div class="bg-muted h-2.5 w-2/5 rounded-full"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if filtered.length === 0}
				<div
					class="border-border text-muted-foreground mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed py-20 text-center"
				>
					<Logo text={false} badge={false} size={44} class="opacity-40" />
					{#if projects.length === 0}
						<p class="text-foreground text-sm font-medium">No projects yet</p>
						<p class="max-w-xs text-xs leading-relaxed">
							Create your first project — everything stays on this device.
						</p>
						<Button size="sm" class="mt-1" onclick={handleCreate}>
							<IconPlus /> New project
						</Button>
					{:else if query.trim()}
						<p class="text-sm">No projects match “{query}”.</p>
					{:else if scope === 'templates'}
						<p class="text-foreground text-sm font-medium">No templates yet</p>
						<p class="max-w-xs text-xs leading-relaxed">
							Starter documents will live here. For now, New project begins from a blank
							article.
						</p>
						<Button size="sm" variant="outline" class="mt-1" onclick={handleCreate}>
							<IconPlus /> New project
						</Button>
					{:else if scope === 'starred'}
						<p class="text-foreground text-sm font-medium">Nothing starred yet</p>
						<p class="max-w-xs text-xs leading-relaxed">
							Star a project from its ⋯ menu to keep it here.
						</p>
					{:else}
						<p class="text-foreground text-sm font-medium">Nothing edited this week</p>
						<p class="max-w-xs text-xs leading-relaxed">
							Recent shows projects you have touched in the last 7 days.
						</p>
					{/if}
				</div>
			{:else}
				<div
					class="mt-7 grid gap-x-5 gap-y-7 {dense
						? 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]'
						: 'grid-cols-[repeat(auto-fill,minmax(190px,1fr))]'}"
					role="list"
					aria-label="Projects"
				>
					<button
						class="group border-border hover:border-ring/50 hover:bg-muted/30 ease-craft flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-all duration-300 hover:-translate-y-1 active:translate-y-0 active:scale-[0.99] motion-reduce:transform-none"
						in:fly={{ y: 10, duration: 360, easing: cubicOut }}
						onclick={handleCreate}
					>
						<span
							class="bg-muted text-muted-foreground group-hover:bg-brand-subtle group-hover:text-brand ease-craft grid size-10 place-items-center rounded-full transition-all duration-300 group-hover:scale-110 motion-reduce:transform-none"
						>
							<IconPlus size={20} />
						</span>
						<span class="text-muted-foreground group-hover:text-foreground text-sm font-medium">
							New project
						</span>
					</button>

					{#each filtered as p, i (p.id)}
						<div
							class="group relative"
							role="listitem"
							in:fly={{ y: 10, duration: 360, delay: Math.min(i, 12) * 26, easing: cubicOut }}
							out:fade={{ duration: 140, easing: cubicOut }}
							animate:flip={{ duration: 320, easing: cubicOut }}
						>
							<button
								class="block w-full text-left"
								onclick={() => onopen?.(p.id)}
								aria-label={`Open ${p.name}`}
							>
								<div class="relative aspect-[4/5]">
									<!-- Ghost pages that fan out from behind the front page on hover. -->
									<div
										aria-hidden="true"
										class="border-border bg-card shadow-craft-sm ease-craft absolute inset-0 rounded-xl border opacity-0 transition-all duration-300 group-hover:-translate-x-3 group-hover:-translate-y-1 group-hover:-rotate-[5deg] group-hover:scale-[0.97] group-hover:opacity-70 motion-reduce:hidden"
									></div>
									<div
										aria-hidden="true"
										class="border-border bg-card shadow-craft-sm ease-craft absolute inset-0 rounded-xl border opacity-0 transition-all duration-300 group-hover:translate-x-3 group-hover:-translate-y-2 group-hover:rotate-[5deg] group-hover:scale-[0.985] group-hover:opacity-100 motion-reduce:hidden"
									></div>

									<!-- Shares its view-transition-name with the editor surface, so
									     opening the project morphs this page into it. -->
									<div
										class="bg-card border-border shadow-craft-sm group-hover:shadow-craft-lg ease-craft absolute inset-0 z-10 overflow-hidden rounded-xl border transition-all duration-300 group-hover:-translate-y-1 group-active:translate-y-0 group-active:scale-[0.985] motion-reduce:transform-none"
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
													<div class="bg-foreground/12 h-1.5 rounded-full" style:width={`${w}%`}></div>
												{/each}
											</div>
											<div class="mt-auto flex items-center gap-1.5">
												<span class="bg-brand/70 h-1.5 w-1.5 rounded-full"></span>
												<div class="bg-foreground/12 h-1.5 w-2/5 rounded-full"></div>
											</div>
										</div>
									</div>
								</div>
							</button>

							<div class="mt-2.5 flex items-start justify-between gap-1.5 px-0.5">
								<div class="min-w-0 flex-1">
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
											class="text-foreground hover:text-brand ease-craft block max-w-full truncate text-left text-sm font-medium transition-colors"
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
								</div>

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
					This permanently deletes the project folder and all its files from your disk.
					This cannot be undone.
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
