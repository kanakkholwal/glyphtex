<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '@glyphtex/ui/dropdown-menu';
	import { Logo } from '@glyphtex/ui/logo';
	import { Tooltip, TooltipContent, TooltipTrigger } from '@glyphtex/ui/tooltip';
	import {
		IconCheck,
		IconChevronDown,
		IconFolderOpen,
		IconFolderShare,
		IconLayoutBottombar,
		IconLayoutSidebar,
		IconLayoutSidebarRight,
		IconLoader2,
		IconPencil,
		IconSearch
	} from '@tabler/icons-svelte';

	import AppMenu from '../app-menu.svelte';
	import ExportMenu from '../export-menu.svelte';
	import { shortcutLabel } from '../shortcuts';
	import BranchMenu from './branch-menu.svelte';
	import CompileControl from './compile-control.svelte';
	import type { WorkbenchController } from './controller.svelte';
	import ModeSwitch from './mode-switch.svelte';
	import PageMenu from './page-menu.svelte';
	import type { SaveFileFn } from './types';

	/** The workbench's one full-width bar: identity, application menus, which
	 *  document is open, where HEAD is, quick-open, and the chrome toggles. */
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

	const crumbSep = 'text-faint shrink-0 select-none';
</script>

{#snippet slash()}
	<span class={crumbSep} aria-hidden="true">/</span>
{/snippet}

<header class="border-border bg-card flex h-11 shrink-0 items-center gap-1 border-b px-2">
	<!-- Identity: the mark goes home, the wordmark opens the application menus. -->
	<Tooltip delayDuration={400}>
		<TooltipTrigger>
			{#snippet child({ props })}
				<a
					{...props}
					href={ctrl.backHref ?? '/'}
					class="hover:bg-muted grid size-8 shrink-0 place-items-center rounded-md transition-colors"
					aria-label={ctrl.backLabel ?? 'Home'}
				>
					<Logo text={false} size="sm" viewTransitionName="app-logo" />
				</a>
			{/snippet}
		</TooltipTrigger>
		<TooltipContent side="bottom">{ctrl.backLabel ?? 'Home'}</TooltipContent>
	</Tooltip>

	<!-- Breadcrumb, Notion's shape: app / document / open file. The app node is
       also where the File-Edit-View menus live, so the row carries the desktop
       menu bar without a second control. -->
	<AppMenu menus={ctrl.menus} focusEditor={() => ctrl.layout.editor?.focusEditor()}>
		{#snippet trigger({ props })}
			<Button
				{...props}
				variant="ghost"
				size="sm"
				class="hidden gap-1 px-2 font-medium sm:inline-flex"
				aria-label="Application menu"
			>
				GlyphTeX
				<IconChevronDown class="size-3 opacity-50" />
			</Button>
		{/snippet}
	</AppMenu>

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
			<DropdownMenuContent align="start" class="w-56">
				{#if ctrl.onRenameProject}
					<DropdownMenuItem onSelect={startRename}>
						<IconPencil class="text-muted-foreground" /> Rename document
					</DropdownMenuItem>
				{/if}
				{#if files.project?.revealInOS && files.projectRoot}
					<DropdownMenuItem onSelect={() => files.revealProject()}>
						<IconFolderShare class="text-muted-foreground" /> Reveal in file explorer
					</DropdownMenuItem>
				{/if}
				{#if ctrl.canOpenFolder}
					<DropdownMenuItem onSelect={() => ctrl.openFolder()}>
						<IconFolderOpen class="text-muted-foreground" /> Open folder…
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

	{#if files.activeFile}
		<span class="hidden lg:inline">{@render slash()}</span>
		<span
			class="text-muted-foreground hidden max-w-40 truncate text-sm lg:inline"
			title={files.activeFile.name}
		>
			{files.activeFile.name}
		</span>
	{/if}

	<BranchMenu head={files.head} onopenpanel={() => layout.selectView('git')} />

	<span class="bg-border mx-1.5 h-4 w-px shrink-0" aria-hidden="true"></span>
	<ModeSwitch {layout} />

	<div class="min-w-2 flex-1"></div>

	{#if layout.docMode === 'latex'}
		<div class="mr-1 hidden shrink-0 items-center gap-0.5 md:flex">
			{#if compile.canCompile}
				<CompileControl {ctrl} />
			{/if}
		</div>
		<span class="bg-border mr-1 hidden h-4 w-px shrink-0 md:block" aria-hidden="true"></span>
	{/if}

	<div class="flex shrink-0 items-center gap-0.5">
		<Button
			variant="ghost"
			size="icon-sm"
			title="Search files ({shortcutLabel('quick-open')})"
			aria-label="Search files"
			onclick={() => (layout.paletteOpen = true)}
		>
			<IconSearch />
		</Button>

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

		{#if saving !== undefined}
			<span
				class="text-muted-foreground mr-1 inline-flex items-center justify-end gap-1 text-xs lg:w-[4.75rem]"
				aria-live="polite"
			>
				{#if saving}
					<IconLoader2 size={14} class="animate-spin" />
					<span class="hidden lg:inline">Saving…</span>
				{:else}
					<IconCheck size={14} class="text-success" />
					<span class="hidden lg:inline">Saved</span>
				{/if}
			</span>
		{/if}

		<Button
			variant="ghost"
			size="icon-sm"
			title="Toggle sidebar ({shortcutLabel('toggle-sidebar')})"
			aria-label="Toggle sidebar"
			aria-pressed={!layout.panelCollapsed}
			onclick={() => (layout.panelCollapsed = !layout.panelCollapsed)}
		>
			{#if layout.sidebarRight}
				<IconLayoutSidebarRight class={layout.panelCollapsed ? 'opacity-60' : ''} />
			{:else}
				<IconLayoutSidebar class={layout.panelCollapsed ? 'opacity-60' : ''} />
			{/if}
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			title="Toggle panel ({shortcutLabel('toggle-panel')})"
			aria-label="Toggle bottom panel"
			aria-pressed={compile.showProblems}
			onclick={() => (compile.showProblems = !compile.showProblems)}
		>
			<IconLayoutBottombar class={compile.showProblems ? '' : 'opacity-60'} />
		</Button>

		<PageMenu {ctrl} onrename={ctrl.onRenameProject ? startRename : undefined} />
	</div>
</header>
