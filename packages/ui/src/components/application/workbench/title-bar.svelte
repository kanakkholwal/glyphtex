<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '@glyphtex/ui/dropdown-menu';
	import { toast } from '@glyphtex/ui/sonner';
	import { Logo } from '@glyphtex/ui/logo';
	import { Tooltip, TooltipContent, TooltipTrigger } from '@glyphtex/ui/tooltip';
	import {
		IconCheck,
		IconChevronDown,
		IconFileImport,
		IconFolderOpen,
		IconFolderShare,
		IconLink,
		IconLoader2,
		IconPencil,
		IconSearch
	} from '@tabler/icons-svelte';

	import ExportMenu from '../export-menu.svelte';
	import { shortcutLabel } from '../shortcuts';
	import BranchMenu from './branch-menu.svelte';
	import CompileControl from './compile-control.svelte';
	import type { WorkbenchController } from './controller.svelte';
	import ModeSwitch from './mode-switch.svelte';
	import PageMenu from './page-menu.svelte';
	import type { SaveFileFn } from './types';

	/** The workbench's one full-width bar: where you are (back link / document /
	 *  branch), which editor you're in, and building. Everything that acts on the
	 *  document hangs off the document's own node; everything else is in ⌘K. */
	let {
		ctrl,
		saving,
		saveFile
	}: {
		ctrl: WorkbenchController;
		saving?: boolean;
		saveFile?: SaveFileFn;
	} = $props();

	const files = $derived(ctrl.files);
	const layout = $derived(ctrl.layout);
	const compile = $derived(ctrl.compile);

	let renaming = $state(false);
	let draft = $state('');
	let field = $state<HTMLInputElement>();

	function startRename(): void {
		if (!ctrl.onRenameProject) return;
		draft = files.displayName;
		renaming = true;
		queueMicrotask(() => field?.select());
	}

	function commitRename(): void {
		renaming = false;
		const next = draft.trim();
		if (next && next !== files.displayName) ctrl.onRenameProject?.(next);
	}

	async function copyLink(): Promise<void> {
		if (typeof location === 'undefined' || !navigator.clipboard) return;
		try {
			await navigator.clipboard.writeText(location.href);
			toast.success('Link copied');
		} catch {
			toast.error('Could not copy the link');
		}
	}

	const crumbSep = 'text-faint shrink-0 select-none';
</script>

{#snippet slash()}
	<span class={crumbSep} aria-hidden="true">/</span>
{/snippet}

<header class="border-border bg-card flex h-11 shrink-0 items-center gap-1 border-b px-2">
	<!-- Breadcrumb root: the mark and the way back are one control, not two adjacent
	     links to the same place. The old first node was a "GlyphTeX" wordmark hiding
	     the File-Edit-View tree, which said nothing about where you were; the tree is
	     in the palette now, so the slot goes to what a breadcrumb owes you. The label
	     drops below `sm`, leaving the mark as the target. -->
	<a
		href={ctrl.backHref ?? '/'}
		class="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-sm transition-colors"
		aria-label={ctrl.backLabel ?? 'Home'}
	>
		<Logo text={false} size="sm" viewTransitionName="app-logo" />
		<span class="hidden sm:inline">{ctrl.backLabel ?? 'Home'}</span>
	</a>
	<span class="hidden sm:inline">{@render slash()}</span>

	<!-- Open document -->
	{#if renaming}
		<!-- Same box as the button it replaces: h-8, px-2, gap-1.5, a chevron-sized
         slot, and a hidden mirror span so the field is sized by its own text. A
         plain input defaults to ~20ch, which shoved the mode switch and every
         control after it the moment you pressed Rename. -->
		<div
			class="bg-input ring-ring/50 flex h-8 max-w-56 min-w-0 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium ring-2 ring-inset"
		>
			<span class="grid min-w-0">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					bind:this={field}
					bind:value={draft}
					autofocus
					class="text-foreground col-start-1 row-start-1 w-full min-w-0 bg-transparent outline-none"
					onblur={commitRename}
					onkeydown={(e) => {
						if (e.key === 'Enter') commitRename();
						else if (e.key === 'Escape') renaming = false;
					}}
					aria-label="Document name"
				/>
				<span class="invisible col-start-1 row-start-1 whitespace-pre" aria-hidden="true">
					{draft || ' '}
				</span>
			</span>
			<IconChevronDown class="size-3 shrink-0 opacity-0" aria-hidden="true" />
		</div>
	{:else}
		<DropdownMenu>
			<DropdownMenuTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="sm"
						class="max-w-56 gap-1.5 px-2 font-medium"
						title={files.displayName}
					>
						<span class="truncate">{files.displayName}</span>
						<IconChevronDown class="size-3 shrink-0 opacity-50" />
					</Button>
				{/snippet}
			</DropdownMenuTrigger>
			<!-- Everything that acts on *the document*. These four used to be here and
			     in the "…" menu 400px away, with no rule for which one to reach for. -->
			<DropdownMenuContent align="start" class="w-56">
				{#if ctrl.onRenameProject}
					<DropdownMenuItem onSelect={startRename}>
						<IconPencil class="text-muted-foreground" /> Rename document
					</DropdownMenuItem>
				{/if}
				{#if ctrl.platform === 'web'}
					<!-- A `tauri://localhost/…` URL is no use to anyone, so this is web-only. -->
					<DropdownMenuItem onSelect={copyLink}>
						<IconLink class="text-muted-foreground" /> Copy link
					</DropdownMenuItem>
				{/if}
				{#if files.project?.revealInOS && files.projectRoot}
					<DropdownMenuItem onSelect={() => files.revealProject()}>
						<IconFolderShare class="text-muted-foreground" /> Reveal in file explorer
					</DropdownMenuItem>
				{/if}
				<DropdownMenuSeparator />
				{#if ctrl.canOpenFolder}
					<DropdownMenuItem onSelect={() => ctrl.openFolder()}>
						<IconFolderOpen class="text-muted-foreground" /> Open folder…
					</DropdownMenuItem>
				{/if}
				{#if ctrl.canImportProject}
					<DropdownMenuItem onSelect={() => ctrl.importProject()}>
						<IconFileImport class="text-muted-foreground" /> Import project…
					</DropdownMenuItem>
				{/if}
				{#if ctrl.onOpenProject}
					<DropdownMenuItem onSelect={() => ctrl.onOpenProject?.()}>
						<IconFolderOpen class="text-muted-foreground" /> Open another document…
					</DropdownMenuItem>
				{/if}
			</DropdownMenuContent>
		</DropdownMenu>
	{/if}

	<!-- Beside the name it describes, not in the far-right control cluster: it is a
	     fact about this document, not a window control. -->
	{#if saving !== undefined}
		<span
			class="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs"
			aria-live="polite"
		>
			{#if saving}
				<IconLoader2 size={13} class="animate-spin" />
				<span class="hidden lg:inline">Saving…</span>
			{:else}
				<IconCheck size={13} class="text-success" />
				<span class="hidden lg:inline">Saved</span>
			{/if}
		</span>
	{/if}

	<BranchMenu head={files.head} onopenpanel={() => layout.selectView('git')} />

	<span class="bg-border mx-1.5 h-4 w-px shrink-0" aria-hidden="true"></span>
	<ModeSwitch {ctrl} />

	<div class="min-w-2 flex-1"></div>

	{#if ctrl.docMode === 'latex'}
		<div class="mr-1 hidden shrink-0 items-center gap-0.5 md:flex">
			{#if compile.canCompile}
				<CompileControl {ctrl} />
			{/if}
		</div>
		<span class="bg-border mr-1 hidden h-4 w-px shrink-0 md:block" aria-hidden="true"></span>
	{/if}

	<div class="flex shrink-0 items-center gap-0.5">
		<Tooltip delayDuration={400}>
			<TooltipTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon-sm"
						aria-label="Search files and commands"
						onclick={() => (layout.paletteOpen = true)}
					>
						<IconSearch />
					</Button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent side="bottom">
				Go to file or run a command ({shortcutLabel('quick-open')})
			</TooltipContent>
		</Tooltip>

		<ExportMenu
			compact
			size="icon-sm"
			source={files.source}
			filename={files.activeFile?.name ?? 'document.tex'}
			pdfBytes={compile.pdfBytes}
			{saveFile}
			onExportZip={ctrl.onExportProject ??
				(files.project ? () => files.exportProject() : undefined)}
			canExportZip={Boolean(ctrl.onExportProject) || Boolean(files.projectRoot)}
		/>

		<!-- The sidebar toggle lives on the tab rail, on the panel's own seam. The
		     bottom-panel toggle is gone from here too: the compile status button is
		     already the control that opens the log it summarises, and a third copy
		     of the same toggle earned nothing. -->
		<PageMenu {ctrl} />
	</div>
</header>
