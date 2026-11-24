<script lang="ts" module>
	import type { Project } from "@glyphtex/ui/projects";
	export type { Project };

	/** A rail destination. Each one is a real route when the host supplies hrefs. */
	export type Scope = "all" | "recent" | "starred" | "templates";
</script>

<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import { shortcutCap } from '@glyphtex/ui/shortcut';
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
	import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@glyphtex/ui/empty';
	import { SearchInput } from '@glyphtex/ui/search-input';
	import { Input } from '@glyphtex/ui/input';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '@glyphtex/ui/tabs';
	import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@glyphtex/ui/collapsible';
	import { Progress } from '../ui/progress';
	import { Spinner } from '@glyphtex/ui/spinner';
	import { Skeleton } from '@glyphtex/ui/skeleton';
	import { FileUpload, FileUploadDropzone, FileUploadError } from '../ui/file-upload';
	import { autoHeight } from '../../lib/auto-height';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '@glyphtex/ui/table';
	import { UserMenu, type UserMenuItem } from '@glyphtex/ui/user-menu';
	import { ThemeToggle as AppThemeToggle } from '../ui/app-theme-toggle';
	import {
		IconArrowsSort,
		IconClock,
		IconBuilding,
		IconCheck,
		IconCircle,
		IconCircleCheckFilled,
		IconDots,
		IconGitBranch,
		IconLock,
		IconSelector,
		IconUser,
		IconUsers,
		IconCloud,
		IconCloudUpload,
		IconCopy,
		IconLogin,
		IconLogout,
		IconShieldLock,
		IconUserCircle,
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
	import type { Snippet } from 'svelte';
	import AboutDialog from './about-dialog.svelte';
	import WorkspaceCommand from './workspace-command.svelte';
	import type { ProjectTemplate } from '../../lib/project-templates';
	import { TemplateFilter } from '../../lib/project-templates/filter.svelte';
	import TemplateCard, { type TemplateCardPreview } from './template-card.svelte';
	import TemplateFilterBar from './template-filter-bar.svelte';

	/** Home screen for every project. The host owns the data and every action; an absent
	 *  handler hides its control (folder actions are desktop-only). */
	let {
		platform = 'desktop',
		projects = [],
		oncreate,
		onopenfolder,
		onimport,
		onimportfolder,
		onimportzip,
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
		templatePreview,
		templatesLead,
		onusetemplate,
		onrequesttemplates,
		importing = false,
		dragging = false,
		onupload,
		account,
		checklist,
		settingsHref,
		adminHref,
		page,
		workspaces,
		onnavigate = (href: string) => (window.location.href = href)
	}: {
		/** Drives the About dialog's platform line and the drop hint. */
		platform?: 'web' | 'desktop';
		projects?: Project[];
		/** Create a project. Return the new id to have the home open it; no id means the host navigates. */
		oncreate?: (name?: string) => string | void | Promise<string | void>;
		/** Open an existing project folder from disk (desktop). */
		onopenfolder?: () => void;
		/** Import a .zip project. */
		onimport?: () => void;
		/** Import a folder from disk, copying it into the project store. */
		onimportfolder?: () => void;
		/** A .zip dropped or picked in the Import tab. */
		onimportzip?: (file: File) => void;
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
		/** First-page image per template id; absent shows a placeholder sheet. */
		templatePreview?: (id: string) => TemplateCardPreview | null;
		/** Host content above the gallery, e.g. an organization's own templates. */
		templatesLead?: Snippet;
		/** Create a project from a template. Return the new id to have the home open it. */
		onusetemplate?: (id: string) => string | void | Promise<string | void>;
		/** The Template tab opened: load the catalog now if the host has not. */
		onrequesttemplates?: () => void;
		/** An import is running: the Import tab shows progress. */
		importing?: boolean;
		/** Files are being dragged over the page: the Import tab shows the drop target. */
		dragging?: boolean;
		/** Copy a browser-only project to the server. Absent hides the action. */
		onupload?: (id: string) => void;
		/** Signed-in identity or a sign-in link for the rail menu; absent when the host has no accounts. */
		account?: { href: string; name: string; email: string; signedIn: boolean; onsignout?: () => unknown };
		/** Adds a Settings destination to the rail. */
		settingsHref?: string;
		/** Set for instance admins: adds the Instance admin entry to the account menu. */
		adminHref?: string;
		/** Client-side navigation for menu and palette destinations (web: SvelteKit goto). */
		onnavigate?: (href: string) => void;
		/** Personal space plus the user's organizations; absent hides the switcher. */
		workspaces?: {
			current: string | null;
			items: { id: string; name: string }[];
			onswitch: (id: string | null) => void;
			oncreate?: () => void;
		};
		/** Replaces the project views with a host page (Settings) inside the same shell. */
		page?: { title: string; description: string; body: Snippet };
		/** First-run checklist for the rail; the host owns each item's `done`. */
		checklist?: { items: { id: string; label: string; done: boolean }[]; ondismiss: () => void };
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
	const leaving = $derived(Boolean(pendingDelete?.cloud && pendingDelete.cloud.role !== 'owner'));


	async function handleCreate() {
		const id = await oncreate?.();
		// A host that returns no id navigates on its own.
		if (typeof id !== 'string') return;
		onopen?.(id);
	}

	let cloning = $state(false);
	type StartTab = 'blank' | 'template' | 'import' | 'clone';
	let startTab = $state<StartTab>('blank');
	let cloneUrl = $state('');
	let cloneBusy = $state(false);

	let checklistOpen = $state<boolean | undefined>(undefined);
	let blankName = $state('');
	let creating = $state(false);
	let templateQuery = $state('');

	async function submitBlank() {
		if (creating) return;
		creating = true;
		try {
			const id = await oncreate?.(blankName.trim() || undefined);
			if (typeof id === 'string') onopen?.(id);
		} finally {
			creating = false;
		}
	}

	function selectStartTab(next: StartTab) {
		startTab = next;
		if (next === 'template') onrequesttemplates?.();
	}

	const startTemplates = $derived.by(() => {
		const q = templateQuery.trim().toLowerCase();
		const list = q
			? templates.filter((t) => t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
			: templates;
		return list.slice(0, 6);
	});

	// What the clone box understands: an https URL with an owner and a repository.
	const cloneTarget = $derived.by(() => {
		const raw = cloneUrl.trim();
		if (!raw) return null;
		try {
			const url = new URL(raw);
			const parts = url.pathname.split('/').filter(Boolean);
			const repo = (parts[1] ?? '').replace(/\.git$/i, '');
			const valid = url.protocol === 'https:' && parts.length >= 2 && repo.length > 0;
			return { valid, host: url.host, owner: parts[0] ?? '', repo };
		} catch {
			return { valid: false, host: '', owner: '', repo: '' };
		}
	});

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

	type Place = 'all' | 'local' | 'cloud' | 'shared';
	let location = $state<Place>('all');
	const hasCloud = $derived(projects.some((p) => p.cloud));
	const locations = $derived<{ id: Place; label: string }[]>([
		{ id: 'all', label: 'All' },
		{ id: 'local', label: platform === 'web' ? 'This browser' : 'This computer' },
		{ id: 'cloud', label: 'Cloud' },
		{ id: 'shared', label: 'Shared with me' }
	]);
	const inLocation = (p: Project) =>
		location === 'all' ||
		(location === 'local'
			? !p.cloud
			: location === 'cloud'
				? p.cloud?.role === 'owner'
				: Boolean(p.cloud && p.cloud.role !== 'owner'));

	const filtered = $derived(
		scoped
			.filter(inLocation)
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
		{ id: 'all', label: 'Projects', icon: IconHome },
		{ id: 'recent', label: 'Recent', icon: IconClock },
		{ id: 'starred', label: 'Starred', icon: IconStar },
		{ id: 'templates', label: 'Templates', icon: IconTemplate }
	];

	// Active rail row: the base fill, medium weight and a blue icon, so it reads without colour.
	// Active scope is a raised pill on the canvas, read by fill and weight rather than colour.
	const railRow =
		'h-8 rounded-lg px-2.5 text-sm transition-colors duration-(--duration-fast) hover:bg-foreground/[0.05] data-active:bg-well data-active:font-medium data-active:shadow-(--surface-shadow)';
	const groupLabel = 'bg-well text-muted-foreground shadow-(--surface-shadow) mx-2 mb-1 h-6 w-fit rounded-md px-2 text-xs';


	const templateFilter = new TemplateFilter(() => templates);
	let usingTemplate = $state<string | null>(null);

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

	const placeOf = (p: Project) =>
		p.cloud
			? p.cloud.role === 'owner'
				? { label: 'Cloud', icon: IconCloud }
				: { label: `Shared · ${p.cloud.role}`, icon: IconUsers }
			: p.root
				? { label: 'On disk', icon: IconFolder }
				: { label: platform === 'web' ? 'This browser' : 'This computer', icon: IconLock };
	const detail = (p: Project) =>
		p.cloud
			? `edited ${relativeTime(p.updatedAt)}`
			: `${p.files.length} ${p.files.length === 1 ? 'file' : 'files'} · ${relativeTime(p.updatedAt)}`;

	const initials = (name: string) =>
		name
			.split(/[\s@.]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase())
			.join('') || '?';

	const menuUser = $derived(
		account?.signedIn
			? { name: account.name, email: account.email }
			: {
					name: platform === 'web' ? 'Guest' : 'This computer',
					email: account ? 'Not signed in' : 'No account needed'
				}
	);
	const menuItems = $derived<UserMenuItem[]>([
		...(account && !account.signedIn
			? [{ label: 'Sign in', icon: loginIcon, onSelect: () => onnavigate(account.href) }]
			: []),
		...(settingsHref
			? [{ label: 'Settings', icon: settingsIcon, onSelect: () => onnavigate(settingsHref) }]
			: onsettings
				? [{ label: platform === 'web' ? 'Storage' : 'Settings', icon: settingsIcon, onSelect: () => onsettings?.() }]
				: []),
		...(adminHref
			? [{ label: 'Instance admin', icon: adminIcon, onSelect: () => onnavigate(adminHref) }]
			: []),
		...(helpHref ? [{ label: 'Help and docs', icon: helpIcon, onSelect: () => window.open(helpHref, '_blank') }] : []),
		{ label: 'About GlyphTeX', icon: aboutIcon, onSelect: () => (aboutOpen = true) }
	]);

	let paletteOpen = $state(false);
	const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

	const checklistDone = $derived(checklist?.items.filter((i) => i.done).length ?? 0);

	const pageTitle = $derived(
		scope === 'recent'
			? 'Recent'
			: scope === 'starred'
				? 'Starred'
				: scope === 'templates'
					? 'Templates'
					: 'Projects'
	);
	const pageDescription = $derived(
		scope === 'recent'
			? 'Projects you edited in the last 7 days.'
			: scope === 'starred'
				? 'Projects you starred from their menu.'
				: scope === 'templates'
					? 'Starter documents for theses, papers, CVs and slides.'
					: platform === 'web'
						? hasCloud
							? 'Documents in this browser and on your GlyphTeX server. All of them compile on this device.'
							: 'Documents saved in this browser. They compile on this device.'
						: 'Projects in folders on this computer. They compile locally.'
	);
	const emptyTitle = $derived(
		query.trim()
			? `No projects match “${query.trim()}”`
			: location !== 'all'
				? 'Nothing here yet'
				: scope === 'starred'
					? 'Nothing starred yet'
					: 'Nothing edited this week'
	);
	const emptyBody = $derived(
		query.trim() || location !== 'all'
			? 'Try another filter or clear the search.'
			: scope === 'starred'
				? 'Star a project from its menu to keep it here.'
				: 'Recent shows projects you touched in the last 7 days.'
	);

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

</script>

{#snippet projectTitle(p: Project)}
	{#if renaming === p.id}
		<!-- svelte-ignore a11y_autofocus -->
		<input
			bind:value={renameValue}
			aria-label="Project name"
			class="bg-background border-ring text-foreground relative z-10 h-7 w-full rounded-md border px-2 text-sm font-medium outline-none"
			autofocus
			onkeydown={(e) => {
				if (e.key === 'Enter') commitRename(p.id);
				if (e.key === 'Escape') renaming = null;
			}}
			onblur={() => commitRename(p.id)}
		/>
	{:else}
		<h3 class="text-foreground truncate text-sm font-medium">
			<button
				class="focus-visible:ring-ring block max-w-full truncate rounded-sm text-left outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:ring-2"
				onclick={() => onopen?.(p.id)}
			>
				{p.name}
			</button>
		</h3>
	{/if}
{/snippet}

{#snippet projectMeta(p: Project)}
	{@const place = placeOf(p)}
	<p class="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs" title={p.root}>
		<place.icon size={13} class="shrink-0" aria-hidden="true" />
		<span class="truncate">{place.label} · {detail(p)}</span>
	</p>
{/snippet}

{#snippet projectIcon(p: Project)}
	<span
		class="bg-raised text-muted-foreground group-hover:text-foreground grid size-10 shrink-0 place-items-center rounded-lg transition-colors duration-(--duration-fast)"
		style:view-transition-name={projectViewTransitionName(p.id)}
		style:view-transition-class="morph-surface"
		aria-hidden="true"
	>
		{#if p.root}<IconFolder size={20} />{:else if p.cloud}<IconCloud size={20} />{:else}<IconFileText
				size={20}
			/>{/if}
	</span>
{/snippet}

{#snippet starBadge(p: Project)}
	{#if p.starred}
		<span class="relative z-10 shrink-0" title="Starred">
			<IconStarFilled class="text-warning-strong size-4" aria-hidden="true" />
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
					class="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-ring relative z-10 grid size-7 shrink-0 place-items-center rounded-md outline-none transition-[opacity,color,background-color] duration-(--duration-base) ease-(--ease-out) focus-visible:opacity-100 focus-visible:ring-2 data-[state=open]:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
					aria-label={`Actions for ${p.name}`}
				>
					<IconDots size={16} />
				</button>
			{/snippet}
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end">
			{#if onstar && !p.cloud}
				<DropdownMenuItem onclick={() => onstar?.(p.id, !p.starred)}>
					{#if p.starred}
						<IconStarFilled class="text-warning-strong" /> Unstar
					{:else}
						<IconStar /> Star
					{/if}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
			{/if}
			{#if !p.cloud || p.cloud.role === 'owner' || p.cloud.role === 'editor'}
				<DropdownMenuItem onclick={() => startRename(p)}>
					<IconPencil /> Rename
				</DropdownMenuItem>
			{/if}
			{#if !p.cloud}
				<DropdownMenuItem onclick={() => onduplicate?.(p.id)}>
					<IconCopy /> Duplicate
				</DropdownMenuItem>
			{/if}
			{#if onupload && !p.cloud && !p.root}
				<DropdownMenuItem onclick={() => onupload?.(p.id)}>
					<IconCloudUpload /> Save to cloud
				</DropdownMenuItem>
			{/if}
			{#if onreveal && p.root}
				<DropdownMenuItem onclick={() => onreveal?.(p.id)} class="whitespace-nowrap">
					<IconFolderShare /> Reveal in file manager
				</DropdownMenuItem>
			{/if}
			<DropdownMenuSeparator />
			<DropdownMenuItem destructive onclick={() => (pendingDelete = p)}>
				{#if p.cloud && p.cloud.role !== 'owner'}<IconLogout /> Leave{:else}<IconTrash /> Delete{/if}
			</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
{/snippet}

{#snippet loginIcon()}<IconLogin />{/snippet}
{#snippet settingsIcon()}<IconSettings />{/snippet}
{#snippet adminIcon()}<IconShieldLock />{/snippet}
{#snippet helpIcon()}<IconHelpCircle />{/snippet}
{#snippet aboutIcon()}<IconInfoCircle />{/snippet}

{#snippet sectionLabel(id: string, label: string, count: number | null)}
	<h2 {id} class="text-muted-foreground text-sm font-medium">
		{label}{#if count !== null}<span class="ml-1.5 tabular-nums">{count}</span>{/if}
	</h2>
{/snippet}

{#snippet pill(active: boolean, label: string, onclick: () => void)}
	<button
		class="focus-visible:ring-ring h-8 rounded-lg px-3 text-sm outline-none transition-[background-color,color] duration-(--duration-fast) ease-(--ease-out) focus-visible:ring-2 {active
			? 'bg-tint text-foreground font-medium'
			: 'text-muted-foreground hover:text-foreground hover:bg-tint'}"
		aria-pressed={active}
		{onclick}
	>
		{label}
	</button>
{/snippet}

{#snippet startRow(icon: typeof IconPlus, title: string, body: string, action: Snippet)}
	{@const Icon = icon}
	<li class="flex items-center gap-4 py-3">
		<span class="bg-muted text-foreground grid size-10 shrink-0 place-items-center rounded-lg" aria-hidden="true">
			<Icon size={20} />
		</span>
		<div class="min-w-0 flex-1">
			<p class="text-foreground text-sm font-medium">{title}</p>
			<p class="text-muted-foreground text-sm">{body}</p>
		</div>
		{@render action()}
	</li>
{/snippet}

{#snippet newAction()}
	<Button variant="dark" size="sm" onclick={handleCreate}><IconPlus /> New</Button>
{/snippet}
{#snippet templateAction()}
	<Button variant="outline" size="sm" href={scopeHrefs?.templates}>Browse</Button>
{/snippet}
{#snippet importAction()}
	<Button variant="outline" size="sm" onclick={() => onimport?.()}>Import</Button>
{/snippet}
{#snippet folderAction()}
	<Button variant="outline" size="sm" onclick={() => (onimportfolder ? onimportfolder() : onopenfolder?.())}
		>Choose</Button
	>
{/snippet}
{#snippet cloneAction()}
	<Button variant="outline" size="sm" onclick={() => (cloning = true)}>Clone</Button>
{/snippet}

{#snippet scopeLink(item: (typeof scopes)[number])}
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
			<Sidebar.MenuButton isActive={activeScope === item.id} class={railRow} tooltipContent={item.label}>
				{#snippet child({ props })}
					<a {href} {...props} aria-current={activeScope === item.id ? 'page' : undefined}>
						<Icon /><span>{item.label}</span>
						{#if count > 0 && !loading}
							<span class="text-muted-foreground ml-auto text-xs tabular-nums group-data-[collapsible=icon]:hidden">{count}</span>
						{/if}
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
	{/if}
{/snippet}

{#snippet startCard()}
	{@const tabs = [
		{ id: 'blank', label: 'Blank' },
		...(onusetemplate && scopeHrefs?.templates ? [{ id: 'template', label: 'Template' }] : []),
		...(onimport || onimportfolder || onopenfolder ? [{ id: 'import', label: 'Import' }] : []),
		...(onclone ? [{ id: 'clone', label: 'Clone' }] : [])
	] as { id: StartTab; label: string }[]}
	<section aria-labelledby="start-title" class="bg-tint mx-auto w-full max-w-4xl rounded-2xl p-1">
		<div class="bg-raised rounded-xl p-5 shadow-(--surface-shadow)">
			<h2 id="start-title" class="sr-only">Start a project</h2>
			<Tabs variant="soft" bind:value={() => startTab, (v) => selectStartTab(v as StartTab)}>
				<TabsList aria-label="Start from">
					{#each tabs as t (t.id)}
						<TabsTrigger value={t.id}>{t.label}</TabsTrigger>
					{/each}
				</TabsList>

				<div class="mt-5" {@attach autoHeight()}>
					<div class="flow-root">
						<TabsContent value="blank" class="data-[state=active]:rise">
							<form
								class="flex flex-col gap-2 sm:flex-row"
								onsubmit={(e) => {
									e.preventDefault();
									void submitBlank();
								}}
							>
								<label class="sr-only" for="blank-name">Project name</label>
								<Input id="blank-name" bind:value={blankName} placeholder="Untitled" disabled={creating} class="min-w-0 flex-1" />
								<Button type="submit" variant="dark" loading={creating} loadingLabel="Creating…">
									<IconPlus /> Create project
								</Button>
							</form>
							<p class="text-muted-foreground mt-3 text-xs">
								Starts from a minimal article with a sections folder. You can rename it any time.
							</p>
						</TabsContent>

						{#if tabs.some((t) => t.id === 'template')}
							<TabsContent value="template" class="data-[state=active]:rise">
								<div class="flex flex-col gap-4">
									<SearchInput
										label="Search templates"
										placeholder="Search theses, papers, CVs, slides…"
										variant="soft"
										size="sm"
										class="w-full sm:w-80"
										bind:value={templateQuery}
									/>
									{#if templatesLoading || (templates.length === 0 && !templateQuery)}
										<div
											class="grid grid-cols-2 gap-3 sm:grid-cols-3"
											aria-busy="true"
											aria-label="Loading templates"
											role="status"
										>
											{#each { length: 6 } as _, i (i)}
												<div class="flex flex-col gap-2">
													<Skeleton class="aspect-[4/3] w-full rounded-xl" />
													<Skeleton class="h-3 w-3/5" />
												</div>
											{/each}
										</div>
									{:else if startTemplates.length === 0}
										<p class="text-muted-foreground text-sm">
											No templates match “{templateQuery.trim()}”.
											<button class="text-foreground underline underline-offset-4" onclick={() => (templateQuery = '')}>
												Clear the search
											</button>
										</p>
									{:else}
										<ul class="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3" aria-label="Templates">
											{#each startTemplates as t, i (t.id)}
												<TemplateCard template={t} preview={templatePreview?.(t.id) ?? null} priority={i < 3}>
													{#snippet action()}
														<Button
															variant="outline"
															size="sm"
															loading={usingTemplate === t.id}
															loadingLabel="Creating…"
															disabled={usingTemplate !== null && usingTemplate !== t.id}
															aria-label={`Use the ${t.title} template`}
															onclick={() => useTemplate(t.id)}
														>
															Use
														</Button>
													{/snippet}
												</TemplateCard>
											{/each}
										</ul>
									{/if}
									{#if scopeHrefs?.templates}
										<a
											href={scopeHrefs.templates}
											class="text-foreground hover:text-muted-foreground w-fit text-sm underline underline-offset-4"
										>
											Browse all {templates.length || ''} templates
										</a>
									{/if}
								</div>
							</TabsContent>
						{/if}

						{#if tabs.some((t) => t.id === 'import')}
							<TabsContent value="import" class="data-[state=active]:rise">
								{#if importing}
									<div class="bg-tint flex items-center gap-3 rounded-xl p-6" role="status" aria-live="polite">
										<Spinner label="Importing" />
										<div>
											<p class="text-foreground text-sm font-medium">Importing your project…</p>
											<p class="text-muted-foreground text-xs">Reading files and skipping build output.</p>
										</div>
									</div>
								{:else}
									<div class="flex flex-col gap-3">
										{#if onimportzip}
											<FileUpload
												files={[]}
												accept=".zip"
												maxFiles={1}
												onFilesAdded={(added) => added[0] && onimportzip?.(added[0])}
											>
												<FileUploadDropzone />
												<FileUploadError />
											</FileUpload>
										{:else if onimport}
											<Button variant="dark" size="sm" class="w-fit" onclick={() => onimport?.()}>
												<IconFileImport /> Choose a .zip
											</Button>
										{/if}
										<div class="flex flex-wrap items-center gap-3">
											{#if onimportfolder || onopenfolder}
												<Button variant="outline" size="sm" onclick={() => (onimportfolder ? onimportfolder() : onopenfolder?.())}>
													<IconFolderOpen /> {onimportfolder ? 'Choose a folder' : 'Open a folder'}
												</Button>
											{/if}
											<p class="text-muted-foreground text-xs">
												Overleaf and Prism exports work. Build output and .gitignore’d files are skipped.
												{dragging ? 'Drop to import.' : ''}
											</p>
										</div>
									</div>
								{/if}
							</TabsContent>
						{/if}

						{#if tabs.some((t) => t.id === 'clone')}
							<TabsContent value="clone" class="data-[state=active]:rise">
								{#if cloneBusy}
									<div class="bg-tint flex flex-col gap-4 rounded-xl p-6" role="status" aria-live="polite">
										<div class="flex items-center gap-3">
											<Spinner label="Cloning" />
											<div class="min-w-0">
												<p class="text-foreground truncate text-sm font-medium">
													Cloning {cloneTarget?.owner}/{cloneTarget?.repo}…
												</p>
												<p class="text-muted-foreground text-xs">
													Fetching from {cloneTarget?.host}. Large repositories take a little while. Everything is stored in this browser.
												</p>
											</div>
										</div>
										<Progress indeterminate size="sm" label="Cloning repository" />
									</div>
								{:else}
									<form
										class="flex flex-col gap-2 sm:flex-row"
										onsubmit={(e) => {
											e.preventDefault();
											if (cloneTarget?.valid) void submitClone();
										}}
									>
										<label class="sr-only" for="start-clone-url">Repository URL</label>
										<Input
											id="start-clone-url"
											bind:value={cloneUrl}
											placeholder="https://github.com/owner/repo.git"
											spellcheck="false"
											aria-invalid={cloneTarget && !cloneTarget.valid ? true : undefined}
											class="min-w-0 flex-1"
										/>
										<Button type="submit" variant="dark" disabled={!cloneTarget?.valid}>
											<IconGitBranch /> Clone
										</Button>
									</form>
									{#if cloneTarget && !cloneTarget.valid}
										<p class="text-destructive-strong mt-3 text-xs">
											Use an https:// repository URL, like https://github.com/owner/repo.git
										</p>
									{:else if cloneTarget?.valid}
										<p class="text-muted-foreground mt-3 text-xs">
											Will clone {cloneTarget.owner}/{cloneTarget.repo} from {cloneTarget.host} into a new project.
										</p>
									{:else}
										<p class="text-muted-foreground mt-3 text-xs">
											Public repositories over HTTPS. GitHub, GitLab and Bitbucket work.
										</p>
									{/if}
								{/if}
							</TabsContent>
						{/if}
					</div>
				</div>
			</Tabs>
		</div>
		<p class="text-muted-foreground px-3 pt-2 pb-1 text-xs">
			{platform === 'web'
				? 'You can also drop a folder or .zip anywhere on this page.'
				: 'Projects are folders on this computer.'}
		</p>
	</section>
{/snippet}

{#snippet cloneForm()}
	<div class="mt-3 flex flex-col gap-2 sm:flex-row">
		<label class="sr-only" for="clone-url">Repository URL</label>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			id="clone-url"
			bind:value={cloneUrl}
			class="bg-background border-border text-foreground placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-ring h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none focus-visible:ring-2"
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
			<Button variant="dark" size="sm" disabled={cloneBusy || !cloneUrl.trim()} onclick={submitClone}>
				{cloneBusy ? 'Cloning…' : 'Clone'}
			</Button>
			<Button variant="ghost" size="sm" disabled={cloneBusy} onclick={() => (cloning = false)}>Cancel</Button>
		</div>
	</div>
{/snippet}

<svelte:window
	onkeydown={(e) => {
		if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			paletteOpen = !paletteOpen;
		}
	}}
/>

<WorkspaceCommand
	bind:open={paletteOpen}
	{projects}
	{scopeHrefs}
	{settingsHref}
	oncreate={oncreate ? handleCreate : undefined}
	{onimport}
	{onimportfolder}
	{onopenfolder}
	onclone={onclone ? () => (cloning = true) : undefined}
	{onopen}
	navigate={onnavigate}
/>

<a
	href="#main"
	class="bg-background text-foreground ring-ring sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-2"
>
	Skip to projects
</a>
<Sidebar.Provider class="bg-canvas text-foreground h-dvh min-h-0">
	<Sidebar.Root variant="sidebar" collapsible="icon" class="border-transparent">
		<Sidebar.Header class="gap-2 px-2 pt-3 pb-1">
			<div class="flex h-9 items-center gap-1 group-data-[collapsible=icon]:justify-center">
				<a
					href={platform === 'web' ? '/' : '/workspace'}
					class="hover:bg-foreground/[0.04] focus-visible:ring-ring flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 outline-none transition-colors focus-visible:ring-2 group-data-[collapsible=icon]:hidden"
				>
					<Logo size={20} badge viewTransitionName="app-logo" class="text-sm font-semibold" />
				</a>
				<Sidebar.Trigger class="size-8 shrink-0" title="Toggle sidebar (Ctrl/⌘ B)" />
			</div>
			{#if workspaces}
					{@const current = workspaces.items.find((w) => w.id === workspaces.current)}
					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<button
									{...props}
									class="bg-well hover:bg-well-hover data-[state=open]:bg-well-hover focus-visible:ring-ring flex h-9 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left shadow-(--surface-shadow) outline-none transition-colors focus-visible:ring-2 group-data-[collapsible=icon]:hidden"
								>
									<span
										class="bg-foreground text-background grid size-5 shrink-0 place-items-center rounded-md text-xs font-semibold"
										aria-hidden="true">{(current?.name ?? 'Personal').slice(0, 1).toUpperCase()}</span
									>
									<span class="text-foreground min-w-0 flex-1 truncate text-sm font-medium"
										>{current?.name ?? 'Personal'}</span
									>
									<IconSelector size={14} class="text-muted-foreground shrink-0" aria-hidden="true" />
								</button>
							{/snippet}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" class="min-w-56">
							<DropdownMenuItem onclick={() => workspaces.onswitch(null)}>
								<IconUser /> Personal
								{#if workspaces.current === null}<IconCheck class="ml-auto" />{/if}
							</DropdownMenuItem>
							{#each workspaces.items as w (w.id)}
								<DropdownMenuItem onclick={() => workspaces.onswitch(w.id)}>
									<IconBuilding /> <span class="truncate">{w.name}</span>
									{#if workspaces.current === w.id}<IconCheck class="ml-auto" />{/if}
								</DropdownMenuItem>
							{/each}
							{#if workspaces.oncreate}
								<DropdownMenuSeparator />
								<DropdownMenuItem onclick={() => workspaces.oncreate?.()}>
									<IconPlus /> Create organization
								</DropdownMenuItem>
							{/if}
						</DropdownMenuContent>
					</DropdownMenu>
			{/if}
			<button
				class="bg-well hover:bg-well-hover text-muted-foreground hover:text-foreground focus-visible:ring-ring flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm shadow-(--surface-shadow) outline-none transition-colors focus-visible:ring-2 group-data-[collapsible=icon]:hidden"
				aria-haspopup="dialog"
				onclick={() => (paletteOpen = true)}
			>
				<IconSearch size={16} aria-hidden="true" />
				<span class="flex-1 text-left">Search…</span>
				<kbd class={shortcutCap()} aria-hidden="true">{isMac ? '⌘' : 'Ctrl'} K</kbd>
			</button>
		</Sidebar.Header>

		<Sidebar.Content class="gap-4 pt-2">
			<Sidebar.Group class="px-2 py-0">
				<Sidebar.GroupLabel class={groupLabel}>Library</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu aria-label="Project scopes" class="gap-0.5">
						{#each scopes.filter((i) => i.id !== 'templates') as item (item.id)}
							{@render scopeLink(item)}
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>

			{#if scopeHrefs?.templates}
				<Sidebar.Group class="px-2 py-0">
					<Sidebar.GroupLabel class={groupLabel}>Explore</Sidebar.GroupLabel>
					<Sidebar.GroupContent>
						<Sidebar.Menu aria-label="Explore" class="gap-0.5">
							{#each scopes.filter((i) => i.id === 'templates') as item (item.id)}
								{@render scopeLink(item)}
							{/each}
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>
			{/if}

			{#if latest.length > 0}
				<Sidebar.Group class="px-2 py-0 group-data-[collapsible=icon]:hidden">
					<Sidebar.GroupLabel class={groupLabel}>Jump back in</Sidebar.GroupLabel>
					<Sidebar.GroupContent>
						<Sidebar.Menu aria-label="Recent projects" class="gap-0.5">
							{#each latest as p (p.id)}
								<Sidebar.MenuItem class="group">
									<Sidebar.MenuButton class="{railRow} pr-9" onclick={() => onopen?.(p.id)}>
										{#if p.root}<IconFolder />{:else if p.cloud}<IconCloud />{:else}<IconFileText />{/if}
										<span class="truncate">{p.name}</span>
									</Sidebar.MenuButton>
									<div class="absolute top-1/2 right-1 -translate-y-1/2 group-data-[collapsible=icon]:hidden">
										{@render projectActions(p)}
									</div>
								</Sidebar.MenuItem>
							{/each}
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>
			{/if}
		</Sidebar.Content>

		<Sidebar.Footer class="gap-2 p-2 group-data-[collapsible=icon]:hidden">
			{#if checklist && checklistDone < checklist.items.length}
				{@const open = checklistOpen ?? checklistDone === 0}
				{@const next = checklist.items.find((i) => !i.done)}
				<section class="bg-well rounded-xl p-3 shadow-(--surface-shadow)" aria-labelledby="checklist-title">
					<Collapsible bind:open={() => open, (v) => (checklistOpen = v)}>
						<div class="flex items-center justify-between gap-1">
							<CollapsibleTrigger class="min-w-0 flex-1">
								<h2 id="checklist-title" class="text-foreground text-sm font-medium">Getting started</h2>
								<span class="text-muted-foreground text-xs tabular-nums">{checklistDone}/{checklist.items.length}</span>
							</CollapsibleTrigger>
							<Button variant="ghost" size="icon-xs" aria-label="Hide getting started" onclick={() => checklist?.ondismiss()}>
								<IconX />
							</Button>
						</div>
						<Progress
							value={checklistDone}
							max={checklist.items.length}
							size="sm"
							label="Getting started progress"
							class="mt-2"
						/>
						{#if !open && next}
							<p class="text-muted-foreground mt-2 truncate text-xs">Next: {next.label}</p>
						{/if}
						<CollapsibleContent>
							<ul class="mt-3 flex flex-col gap-1.5">
								{#each checklist.items as item (item.id)}
									<li class="flex items-center gap-2 text-xs">
										{#if item.done}
											<IconCircleCheckFilled size={15} class="text-foreground shrink-0" aria-hidden="true" />
											<span class="text-muted-foreground line-through">{item.label}</span>
										{:else}
											<IconCircle size={15} class="text-muted-foreground shrink-0" aria-hidden="true" />
											<span class="text-foreground">{item.label}</span>
										{/if}
										<span class="sr-only">{item.done ? '(done)' : '(to do)'}</span>
									</li>
								{/each}
							</ul>
						</CollapsibleContent>
					</Collapsible>
				</section>
			{/if}

			{#if storage}
				{@const tight = storagePct >= 80}
				<!-- Warning past 80%: the browser starts evicting under storage pressure. -->
				<button
					class="hover:bg-foreground/[0.05] focus-visible:ring-ring flex flex-col gap-1.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors duration-(--duration-fast) focus-visible:ring-2"
					onclick={() => onsettings?.()}
					aria-label="Browser storage details"
				>
					<span class="flex w-full items-center justify-between gap-2 text-xs">
						<span class="text-muted-foreground">Browser storage</span>
						<span class="text-muted-foreground tabular-nums">
							{formatBytes(storage.used)} / {formatBytes(storage.total)}
						</span>
					</span>
					<Progress
						value={Math.round(storagePct)}
						size="sm"
						tone={tight ? 'destructive' : 'default'}
						label="Local storage used"
					/>
					{#if tight}
						<span class="text-warning-strong text-xs font-medium">Nearly full. The browser may clear it.</span>
					{/if}
				</button>
			{/if}

			{#if settingsHref}
				<Sidebar.Menu aria-label="Settings" class="gap-0.5">
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={Boolean(page)} class={railRow} tooltipContent="Settings">
							{#snippet child({ props })}
								<a href={settingsHref} {...props} aria-current={page ? 'page' : undefined}>
									<IconSettings /><span>Settings</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			{/if}

			<div class="flex items-center gap-1">
				<div class="min-w-0 flex-1 [&_[data-slot=user-menu-trigger]]:w-full">
					<UserMenu
						user={menuUser}
						items={menuItems}
						showName
						align="start"
						onSignOut={account?.signedIn ? account.onsignout : undefined}
					/>
				</div>
				<AppThemeToggle size="icon" class="text-muted-foreground shrink-0" />
			</div>
		</Sidebar.Footer>

		<Sidebar.Rail />
	</Sidebar.Root>

	<!-- Sidebar.Inset renders the page's one <main>; the id is the skip link's target. -->
	<Sidebar.Inset
		id="main"
		tabindex={-1}
		class="workspace-card min-h-0 overflow-hidden outline-none md:my-1.5 md:mr-1.5 md:rounded-xl md:shadow-(--surface-shadow)"
	>
		<div class="min-h-0 min-w-0 flex-1 overflow-auto">
			<div class="flex h-12 items-center px-3 md:hidden">
				<Sidebar.Trigger class="size-9" title="Open sidebar" />
			</div>

			<div class="mx-auto w-full max-w-6xl px-5 pt-6 pb-20 sm:px-8 md:pt-12 lg:px-12">
				<header class="flex flex-col items-center gap-2 text-center">
					<h1 class="text-foreground text-3xl font-normal tracking-tight md:text-4xl">{page?.title ?? pageTitle}</h1>
					<p class="text-muted-foreground max-w-xl text-sm">{page?.description ?? pageDescription}</p>
				</header>

				{#if page}
					<div class="mt-8">{@render page.body()}</div>
				{:else if scope === 'templates'}
					{#if templatesLead}<div class="mt-8">{@render templatesLead()}</div>{/if}
					<section aria-labelledby="templates-label" class="mt-8 flex flex-col gap-3">
						{@render sectionLabel('templates-label', 'Templates', templatesLoading ? null : templates.length)}
						{#if templatesLoading}
							<div
								class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4"
								aria-busy="true"
								aria-label="Loading templates"
								role="status"
							>
								{#each { length: 8 } as _, i (i)}
									<div class="border-border flex animate-pulse flex-col overflow-hidden rounded-xl border">
										<div class="bg-muted aspect-[4/3]"></div>
										<div class="flex flex-col gap-2 p-3">
											<div class="bg-muted h-3 w-3/5 rounded-full"></div>
											<div class="bg-muted h-2.5 w-2/5 rounded-full"></div>
										</div>
									</div>
								{/each}
							</div>
						{:else if templates.length > 0}
							<TemplateFilterBar filter={templateFilter} />
							{#if templateFilter.visible.length === 0}
								<div class="border-border flex flex-col items-center gap-3 rounded-xl border px-6 py-16 text-center">
									<p class="text-foreground text-sm font-medium">
										{templateFilter.query.trim()
											? `No templates match “${templateFilter.query.trim()}”`
											: 'No templates in this view'}
									</p>
									<Button variant="outline" size="sm" onclick={() => templateFilter.clear()}>
										<IconX /> Clear filters
									</Button>
								</div>
							{:else}
								<ul class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4" aria-label="Templates">
									{#each templateFilter.visible as t, i (t.id)}
										<TemplateCard template={t} preview={templatePreview?.(t.id) ?? null} priority={i < 4}>
											{#snippet action()}
												<div class="flex items-center gap-1">
													{#if t.origin === 'overleaf'}
														<Button
															href={t.sourceUrl}
															target="_blank"
															rel="noopener noreferrer"
															variant="ghost"
															size="icon-sm"
															aria-label={`Original source of ${t.title}`}
															title="Original source"
														>
															<IconExternalLink />
														</Button>
													{/if}
													<Button
														variant="outline"
														size="sm"
														loading={usingTemplate === t.id}
														loadingLabel="Creating…"
														disabled={usingTemplate !== null && usingTemplate !== t.id}
														aria-label={`Use the ${t.title} template`}
														onclick={() => useTemplate(t.id)}
													>
														Use
													</Button>
												</div>
											{/snippet}
										</TemplateCard>
									{/each}
								</ul>
							{/if}
						{/if}
					</section>
				{:else if scope === 'all' && !loading && projects.length === 0}
					<div class="mt-10">{@render startCard()}</div>
				{:else}
					{#if scope === 'all'}<div class="mt-10">{@render startCard()}</div>{/if}
					<section aria-labelledby="projects-label" class="mx-auto mt-12 flex w-full max-w-4xl flex-col gap-3">
						{#if scope !== 'all'}
							{@render sectionLabel(
								'projects-label',
								pageTitle,
								loading ? null : query.trim() || location !== 'all' ? filtered.length : scoped.length
							)}
						{:else}
							<h2 id="projects-label" class="sr-only">{pageTitle}</h2>
						{/if}

						<div class="flex flex-wrap items-center gap-2">
							<SearchInput
								id="project-search"
								label="Search projects"
								placeholder="Search projects…"
								shortcut="/"
								size="sm"
								variant="soft"
								class="w-full sm:w-64"
								bind:value={query}
							/>
							{#if hasCloud}
								<div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by location">
									{#each locations as l (l.id)}
										{@render pill(location === l.id, l.label, () => (location = l.id))}
									{/each}
								</div>
							{/if}
							<div class="ml-auto flex flex-wrap items-center gap-2">
								<DropdownMenu>
									<DropdownMenuTrigger>
										{#snippet child({ props })}
											<Button {...props} variant="secondary" size="icon-sm" aria-label="Sort projects" title="Sort">
												<IconArrowsSort />
											</Button>
										{/snippet}
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										{#each sorts as option (option.id)}
											<DropdownMenuCheckboxItem checked={sort === option.id} onCheckedChange={() => (sort = option.id)}>
												{option.label}
											</DropdownMenuCheckboxItem>
										{/each}
									</DropdownMenuContent>
								</DropdownMenu>

								<div class="bg-tint flex h-8 items-center rounded-lg p-0.5" role="group" aria-label="View mode">
									{#each [{ id: 'grid', label: 'Grid view', icon: IconLayoutGrid }, { id: 'list', label: 'List view', icon: IconLayoutList }] as const as mode (mode.id)}
										<button
											class="focus-visible:ring-ring grid size-7 place-items-center rounded-md outline-none transition-colors duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-inset {view ===
											mode.id
												? 'bg-raised text-foreground shadow-(--surface-shadow)'
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

								{#if scope !== 'all' && (onimport || onimportfolder || onopenfolder || onclone)}
									<DropdownMenu>
										<DropdownMenuTrigger>
											{#snippet child({ props })}
												<Button {...props} variant="outline" size="sm"><IconFileImport /> Import</Button>
											{/snippet}
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											{#if onimport}
												<DropdownMenuItem onclick={() => onimport?.()}><IconFileImport /> Import .zip</DropdownMenuItem>
											{/if}
											{#if onimportfolder}
												<DropdownMenuItem onclick={() => onimportfolder?.()}><IconFolderOpen /> Import folder</DropdownMenuItem>
											{/if}
											{#if onopenfolder}
												<DropdownMenuItem onclick={() => onopenfolder?.()}><IconFolderOpen /> Open folder</DropdownMenuItem>
											{/if}
											{#if onclone}
												<DropdownMenuItem onclick={() => (cloning = true)}><IconGitBranch /> Clone repository</DropdownMenuItem>
											{/if}
										</DropdownMenuContent>
									</DropdownMenu>
								{/if}
								{#if scope !== 'all'}
									<Button variant="dark" size="sm" onclick={handleCreate}>
										<IconPlus /> New project
									</Button>
								{/if}
							</div>
						</div>

						{#if onclone && cloning}{@render cloneForm()}{/if}

						{#if loading}
							<div
								class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3"
								aria-busy="true"
								aria-label="Loading projects"
								role="status"
							>
								{#each { length: 6 } as _, i (i)}
									<div class="bg-tint flex items-center gap-3 rounded-xl p-3">
										<Skeleton class="size-10 rounded-lg" />
										<div class="flex flex-1 flex-col gap-1.5">
											<Skeleton class="h-3 w-3/5" />
											<Skeleton class="h-2.5 w-2/5" />
										</div>
									</div>
								{/each}
							</div>
						{:else if filtered.length === 0}
							<Empty class="bg-tint rounded-xl">
								<EmptyHeader>
									<EmptyMedia variant="icon">
										{#if query.trim()}<IconSearch />{:else if scope === 'starred'}<IconStar />{:else}<IconClock />{/if}
									</EmptyMedia>
									<EmptyTitle>{emptyTitle}</EmptyTitle>
									<EmptyDescription>{emptyBody}</EmptyDescription>
								</EmptyHeader>
								<EmptyContent>
									{#if query.trim() || location !== 'all'}
										<Button
											variant="outline"
											size="sm"
											onclick={() => {
												query = '';
												location = 'all';
											}}
										>
											<IconX /> Clear filters
										</Button>
									{:else if scopeHrefs?.all && scope !== 'all'}
										<Button variant="outline" size="sm" href={scopeHrefs.all}>
											<IconHome /> All projects
										</Button>
									{/if}
								</EmptyContent>
							</Empty>
						{:else if view === 'list'}
							<Table variant="framed" class="min-w-[36rem] table-fixed">
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead class="w-36">Location</TableHead>
										<TableHead class="w-20 text-right">Files</TableHead>
										<TableHead class="w-32">Edited</TableHead>
										<TableHead class="w-12"><span class="sr-only">Actions</span></TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{#each filtered as p (p.id)}
										{@const place = placeOf(p)}
										<TableRow class="group relative">
											<TableCell class="max-w-0 py-2.5">
												<div class="flex min-w-0 items-center gap-2.5">
													{#if p.root}<IconFolder size={16} class="text-muted-foreground shrink-0" />{:else if p.cloud}<IconCloud
															size={16}
															class="text-muted-foreground shrink-0"
														/>{:else}<IconFileText size={16} class="text-muted-foreground shrink-0" />{/if}
													<div class="min-w-0 flex-1">{@render projectTitle(p)}</div>
													{@render starBadge(p)}
												</div>
											</TableCell>
											<TableCell class="text-muted-foreground whitespace-nowrap">
												<span class="inline-flex items-center gap-1.5"
													><place.icon size={14} aria-hidden="true" />{place.label}</span
												>
											</TableCell>
											<TableCell class="text-muted-foreground text-right tabular-nums">{p.cloud ? '·' : p.files.length}</TableCell>
											<TableCell class="text-muted-foreground whitespace-nowrap">{relativeTime(p.updatedAt)}</TableCell>
											<TableCell class="text-right">{@render projectActions(p)}</TableCell>
										</TableRow>
									{/each}
								</TableBody>
							</Table>
						{:else}
							<ul class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3" aria-label="Projects">
								{#each filtered as p (p.id)}
									<li
										class="group bg-tint hover:bg-tint-hover relative flex items-center gap-3 rounded-xl p-3 transition-colors duration-(--duration-fast) ease-(--ease-out)"
									>
										{@render projectIcon(p)}
										<div class="min-w-0 flex-1">
											{@render projectTitle(p)}
											{@render projectMeta(p)}
										</div>
										{@render starBadge(p)}
										{@render projectActions(p)}
									</li>
								{/each}
							</ul>
						{/if}
					</section>
				{/if}
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<AboutDialog bind:open={aboutOpen} {platform} />

<!-- Disk-backed projects show their path: confirming deletes the folder itself. -->
<Dialog bind:open={() => pendingDelete !== null, (o) => (o ? null : (pendingDelete = null))}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle
				>{leaving ? 'Leave' : 'Delete'} “{pendingDelete?.name}”?</DialogTitle
			>
			<DialogDescription>
				{#if leaving}
					You lose access until someone shares it with you again. The project stays with its owner.
				{:else if pendingDelete?.cloud}
					This permanently deletes the project and all its files from the server for everyone it
					is shared with. This cannot be undone.
				{:else if pendingDelete?.root}
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
				{#if leaving}<IconLogout /> Leave{:else}<IconTrash /> Delete{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
