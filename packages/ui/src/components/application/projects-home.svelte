<script lang="ts" module>
	import type { Project } from '@glyphtex/ui/projects';
	export type { Project };
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
	  DropdownMenuContent,
	  DropdownMenuItem,
	  DropdownMenuSeparator,
	  DropdownMenuTrigger
	} from '@glyphtex/ui/dropdown-menu';
	import { Logo } from '@glyphtex/ui/logo';
	import { projectViewTransitionName } from '@glyphtex/ui/projects';
	import { ThemeToggle } from '@glyphtex/ui/theme-toggle';
	import {
	  IconChevronDown,
	  IconCloudDownload,
	  IconCopy,
	  IconDotsVertical,
	  IconFileImport,
	  IconFolderOpen,
	  IconFolderShare,
	  IconInfoCircle,
	  IconPencil,
	  IconPlus,
	  IconSearch,
	  IconSettings,
	  IconTrash
	} from '@tabler/icons-svelte';
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import AboutDialog from './about-dialog.svelte';

	/**
	 * ProjectsHome — the application's home screen: every LaTeX project listed as
	 * a document-style card. Calm monochrome chrome; the cards themselves read as
	 * little pages. The host owns the data (the projects store) and the actions.
	 * Folder actions (`onopenfolder` / `onimport`) appear only when the host
	 * supports them (desktop); on web only `oncreate` is shown.
	 */
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
		onsettings
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
	} = $props();

	let query = $state('');
	let renaming = $state<string | null>(null);
	let renameValue = $state('');
	let aboutOpen = $state(false);
	// The project pending a delete confirmation (null = dialog closed).
	let pendingDelete = $state<Project | null>(null);

	// Scroll-aware toolbar: borderless + transparent at the top, a translucent
	// blur + hairline settle in once content scrolls beneath it.
	let scrollEl = $state<HTMLElement>();
	let scrolled = $state(false);
	function onScroll() {
		scrolled = (scrollEl?.scrollTop ?? 0) > 4;
	}

	// New project: create → let the freshly-inserted card fly in and settle →
	// *then* open it, so the card→editor view-transition morphs from a finished
	// card instead of one that's still mid-entrance. The card lands at index 0
	// (newest first), so its `in:fly` is ~360ms; we wait a touch longer.
	const NEW_CARD_REVEAL_MS = 400;
	async function handleCreate() {
		const id = await oncreate?.();
		// A host that returns no id navigates on its own (legacy) — nothing to do.
		if (typeof id !== 'string') return;
		await tick(); // flush the inserted card into the DOM so its entrance starts
		await new Promise((resolve) => setTimeout(resolve, NEW_CARD_REVEAL_MS));
		onopen?.(id);
	}

	// Inline clone bar (no custom dialog — a text field + native folder picker).
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

	const filtered = $derived(
		projects.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
	);

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

<div class="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
	<!-- Scroll surface. The toolbar lives *inside* it and floats translucently;
	     content slides under it and a hairline + blur settle in only once scrolled
	     — the macOS unified-toolbar feel, no hard web-style border at rest. -->
	<div bind:this={scrollEl} onscroll={onScroll} class="min-h-0 flex-1 overflow-auto">
		<!-- Toolbar — brand + global controls. -->
		<header
			class="ease-craft sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b px-6 transition-[background-color,border-color,box-shadow] duration-300 {scrolled
				? 'border-border bg-background/75 shadow-craft-sm backdrop-blur-xl'
				: 'border-transparent bg-transparent'}"
		>
			<Logo size={26} viewTransitionName="app-logo" class="text-base tracking-tight" />
			<div class="flex items-center gap-0.5">
			<ThemeToggle size="icon-sm" />
			<Button
				size="icon-sm"
				variant="ghost"
				title="About GlyphTeX"
				aria-label="About GlyphTeX"
				onclick={() => (aboutOpen = true)}
			>
				<IconInfoCircle size={16} />
			</Button>
			{#if onsettings}
				<div class="bg-border mx-1 h-5 w-px"></div>
				<Button
					size="sm"
					variant="ghost"
					onclick={() => onsettings?.()}
				>
					<IconSettings size={15} /> Settings
				</Button>
			{/if}
		</div>
		</header>

		<div class="mx-auto w-full max-w-[1140px] px-6 pt-6 pb-12">
			<!-- Hero: title + the project actions (create / open / import / clone). -->
			<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
				<div>
					<h1 class="font-display text-3xl font-semibold tracking-tight">Your projects</h1>
					<p class="text-muted-foreground mt-1.5 text-sm">
						{projects.length}
						{projects.length === 1 ? 'project' : 'projects'} · stored on this device
					</p>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<!-- "Bring in an existing project" actions collapse into one Open menu
					     so the primary New-project action stays unambiguous. -->
					{#if onopenfolder || onimport || onclone}
						<DropdownMenu>
							<DropdownMenuTrigger>
								{#snippet child({ props })}
									<Button {...props} size="sm" variant="outline">
										<IconFolderOpen size={15} /> Open
										<IconChevronDown size={14} class="opacity-60" />
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
						<IconPlus size={15} /> New project
					</Button>
				</div>
			</div>

			<!-- Clone bar (inline, contextually under the Clone action). -->
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

			<!-- Search -->
			<div class="relative mt-6">
				<IconSearch
					size={16}
					class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
				/>
				<input
					bind:value={query}
					class="bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 shadow-craft-sm ease-craft h-11 w-full rounded-2xl border py-2 pr-3 pl-10 text-sm outline-none transition-[box-shadow,border-color] duration-200 focus-visible:ring-2"
					placeholder="Search projects"
					spellcheck="false"
					aria-label="Search projects"
				/>
			</div>

			{#if filtered.length === 0}
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
							<IconPlus size={15} /> New project
						</Button>
					{:else}
						<p class="text-sm">No projects match “{query}”.</p>
					{/if}
				</div>
			{:else}
				<div
					class="mt-7 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-5 gap-y-7"
					role="list"
					aria-label="Projects"
				>
					<!-- New-project card -->
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
							<!-- Open target: the document/stack. -->
							<button
								class="block w-full text-left"
								onclick={() => onopen?.(p.id)}
								aria-label={`Open ${p.name}`}
							>
								<!-- The "document" — a little page sitting in front of a fanned
								     stack of pages. On hover the back cards rise and fan out from
								     behind, like lifting a folder of papers. Shares a
								     view-transition-name with the editor surface so it morphs in. -->
								<div class="relative aspect-[4/5]">
									<!-- Back-of-stack ghost pages (decorative). Hidden behind the
									     front page at rest; they settle out on hover. One shared
									     easing per DESIGN.md — they fade + rise, never bounce. -->
									<div
										aria-hidden="true"
										class="border-border bg-card shadow-craft-sm ease-craft absolute inset-0 rounded-xl border opacity-0 transition-all duration-300 group-hover:-translate-x-3 group-hover:-translate-y-1 group-hover:-rotate-[5deg] group-hover:scale-[0.97] group-hover:opacity-70 motion-reduce:hidden"
									></div>
									<div
										aria-hidden="true"
										class="border-border bg-card shadow-craft-sm ease-craft absolute inset-0 rounded-xl border opacity-0 transition-all duration-300 group-hover:translate-x-3 group-hover:-translate-y-2 group-hover:rotate-[5deg] group-hover:scale-[0.985] group-hover:opacity-100 motion-reduce:hidden"
									></div>

									<!-- The front page. -->
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

							<!-- Footer: name + meta on the left, the ⋯ actions menu on the
							     right (rename / duplicate / reveal / delete). -->
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
	</div>
</div>

<!-- About GlyphTeX — brand, version, and links out (GitHub / website). -->
<AboutDialog bind:open={aboutOpen} {platform} />

<!-- Delete confirmation. Disk-backed projects show their folder path, because
     confirming removes the folder from disk (not just the list). -->
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
