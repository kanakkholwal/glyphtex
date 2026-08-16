<script lang="ts" module>
	export type TreeFile = { type: 'file'; id: string; name: string };
	export type TreeFolder = { type: 'folder'; name: string; path: string; children: TreeNode[] };
	export type TreeNode = TreeFile | TreeFolder;

	/** How long a drag has to hover a collapsed folder before it springs open. */
	const SPRING_MS = 600;
	const STEP = 12;
</script>

<script lang="ts">
	import {
		IconChevronRight,
		IconDots,
		IconFile,
		IconFileCode,
		IconFileText,
		IconFileTypePdf,
		IconFolder,
		IconFolderOpen,
		IconPhoto
	} from '@tabler/icons-svelte';
	import { MediaQuery } from 'svelte/reactivity';

	import { canDropInto, getDrag, setDrag } from './file-dnd';
	import { classifyFile, type FileKind } from './file-kinds';
	import type { SidePanelStore } from './side-panel/store.svelte';
	import type { TreeRow } from './side-panel/tree';
	import TreeMenu, { type TreeAction } from './side-panel/tree-menu.svelte';

	let {
		store,
		activeId = '',
		mainId = null,
		onopen,
		onrename,
		onsetmain,
		onrenamefolder,
		ondownloadfile,
		ondownloadfolder,
		oncopypath
	}: {
		store: SidePanelStore;
		activeId?: string;
		/** Compile-target file. */
		mainId?: string | null;
		onopen?: (id: string) => void;
		/** Receives the new leaf name; the folder prefix is preserved upstream. */
		onrename?: (id: string, name: string) => void;
		/** Omitted when there's no project: hides the "Set as main" item. */
		onsetmain?: (id: string) => void;
		/** Receives the new leaf name. */
		onrenamefolder?: (path: string, name: string) => void;
		/** Save one file to disk. Omitted (web-only host seam) hides the item. */
		ondownloadfile?: (id: string) => void;
		/** Save a folder as a .zip. Omitted hides the item. */
		ondownloadfolder?: (path: string) => void;
		oncopypath?: (rel: string) => void;
	} = $props();

	const reduced = new MediaQuery('prefers-reduced-motion: reduce');

	const KIND_ICON: Record<FileKind, typeof IconFile> = {
		latex: IconFileText,
		markdown: IconFileText,
		text: IconFileCode,
		image: IconPhoto,
		pdf: IconFileTypePdf,
		binary: IconFile
	};

	const isTex = (name: string) => /\.tex$/i.test(name);
	const relOf = (row: TreeRow) =>
		row.node.type === 'folder' ? row.node.path : row.node.name;
	const indent = (depth: number) => `${depth * STEP + 8}px`;

	const rows = $derived(store.rows);

	let listEl = $state<HTMLElement>();
	let renamingKey = $state<string | null>(null);
	let renameValue = $state('');
	let dragOverKey = $state<string | null>(null);
	let menu = $state<{ x: number; y: number; row: TreeRow } | null>(null);

	// --- Roving focus -----------------------------------------------------------
	// One tab stop for the whole tree. Every row used to be its own, so a 40-file
	// project cost 80 stops to tab past.
	const focusedKey = $derived(
		store.focusedKey && rows.some((r) => r.key === store.focusedKey)
			? store.focusedKey
			: (rows.find((r) => r.key === `f:${activeId}`)?.key ?? rows[0]?.key ?? null)
	);

	function focusRow(key: string | null, scroll = true) {
		if (!key) return;
		store.focusedKey = key;
		if (!scroll) return;
		const el = listEl?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
		el?.focus({ preventScroll: true });
		el?.scrollIntoView({ block: 'nearest' });
	}

	// Follow a reveal (opening a file from the palette, a tab, or Reveal): the row
	// may have been off-screen or inside a folder that was closed.
	$effect(() => {
		const key = store.focusedKey;
		if (!key || !listEl) return;
		const el = listEl.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
		el?.scrollIntoView({ block: 'nearest', behavior: reduced.current ? 'auto' : 'smooth' });
	});

	// --- Activation -------------------------------------------------------------
	function activate(row: TreeRow, mods: { meta?: boolean; shift?: boolean } = {}) {
		const wasOnlySelection = store.selectedKeys.length === 1 && store.isSelected(row.key);
		store.pick(row.key, mods);
		if (mods.meta || mods.shift) return;
		if (row.node.type === 'file') {
			onopen?.(row.node.id);
			return;
		}
		// Reaching for a folder never closes it: the click that aims "New file" at one
		// only selects and opens. Clicking the row you are already on collapses it, so
		// closing stays a full-width target rather than the chevron alone.
		if (wasOnlySelection && row.expanded) store.toggleFolder(row.node.path);
		else store.openFolder(row.node.path);
	}

	function onRowKeyDown(event: KeyboardEvent, row: TreeRow) {
		const at = rows.findIndex((r) => r.key === row.key);
		const go = (i: number) => {
			event.preventDefault();
			focusRow(rows[Math.max(0, Math.min(rows.length - 1, i))]?.key ?? null);
		};
		switch (event.key) {
			case 'ArrowDown':
				return go(at + 1);
			case 'ArrowUp':
				return go(at - 1);
			case 'Home':
				return go(0);
			case 'End':
				return go(rows.length - 1);
			case 'ArrowRight':
				if (row.node.type === 'folder' && !row.expanded) {
					event.preventDefault();
					store.openFolder(row.node.path);
				} else if (row.node.type === 'folder') go(at + 1);
				return;
			case 'ArrowLeft': {
				if (row.node.type === 'folder' && row.expanded) {
					event.preventDefault();
					store.toggleFolder(row.node.path);
					return;
				}
				// Already collapsed, or a file: climb to the parent row.
				event.preventDefault();
				for (let i = at - 1; i >= 0; i--)
					if (rows[i].depth < row.depth) return focusRow(rows[i].key);
				return;
			}
			case 'Enter':
				event.preventDefault();
				return activate(row);
			case ' ':
				event.preventDefault();
				return store.pick(row.key, { meta: true });
			case 'F2':
				event.preventDefault();
				return startRename(row);
			case 'Delete':
			case 'Backspace':
				event.preventDefault();
				// Only narrow to this row when it is not already part of the selection:
				// re-picking a selected row would toggle it back out of it.
				if (!store.isSelected(row.key)) store.pick(row.key);
				return store.deleteSelected();
			case 'Escape':
				return (store.treeFilter = '');
		}
		// Type-ahead: a single printable character jumps to the next row starting
		// with it, wrapping past the current one.
		if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
			const needle = event.key.toLowerCase();
			for (let n = 1; n <= rows.length; n++) {
				const candidate = rows[(at + n) % rows.length];
				if (candidate.node.name.toLowerCase().startsWith(needle)) {
					event.preventDefault();
					focusRow(candidate.key);
					return;
				}
			}
		}
	}

	// --- Rename -----------------------------------------------------------------
	function startRename(row: TreeRow) {
		renamingKey = row.key;
		renameValue = row.node.name;
	}
	function commitRename() {
		const key = renamingKey;
		const row = rows.find((r) => r.key === key);
		renamingKey = null;
		const name = renameValue.trim();
		if (!row || !name || name === row.node.name) return;
		if (row.node.type === 'folder') onrenamefolder?.(row.node.path, name);
		else onrename?.(row.node.id, name);
	}
	/** Select the basename, not the extension: renaming keeps the type far more
	 *  often than it changes it. */
	function selectBase(input: HTMLInputElement, isFile: boolean) {
		const dot = input.value.lastIndexOf('.');
		input.focus();
		input.setSelectionRange(0, isFile && dot > 0 ? dot : input.value.length);
	}

	// --- Drag & drop ------------------------------------------------------------
	let springTimer: ReturnType<typeof setTimeout> | undefined;
	function cancelSpring() {
		clearTimeout(springTimer);
		springTimer = undefined;
	}

	function onDragStart(row: TreeRow, event: DragEvent) {
		const items = store.dragPayload(row.key);
		setDrag(items);
		event.dataTransfer?.setData('text/plain', items.map((i) => i.name).join('\n'));
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}
	function onDragOver(row: TreeRow, event: DragEvent) {
		if (!getDrag().length) return;
		const dir = row.dropDir;
		const ok = canDropInto(dir);
		event.preventDefault();
		event.stopPropagation(); // innermost target only: no double highlight up the tree
		if (event.dataTransfer) event.dataTransfer.dropEffect = ok ? 'move' : 'none';
		dragOverKey = ok ? row.key : null;
		// Spring-load: you cannot otherwise drop into a folder that is closed.
		if (ok && row.node.type === 'folder' && !row.expanded && !springTimer) {
			const path = row.node.path;
			springTimer = setTimeout(() => {
				springTimer = undefined;
				if (getDrag().length) store.openFolder(path);
			}, SPRING_MS);
		}
	}
	function onDragLeave() {
		dragOverKey = null;
		cancelSpring();
	}
	function onDrop(row: TreeRow, event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		dragOverKey = null;
		cancelSpring();
		// A file row targets its parent: aiming one row off is the common mis-hit,
		// and the intent is unambiguous.
		store.dropInto(row.dropDir);
	}

	// --- Context menu -----------------------------------------------------------
	function openMenu(event: MouseEvent, row: TreeRow) {
		event.preventDefault();
		event.stopPropagation();
		if (!store.isSelected(row.key)) store.pick(row.key);
		focusRow(row.key, false);
		menu = { x: event.clientX, y: event.clientY, row };
	}

	function runAction(action: TreeAction) {
		const row = menu?.row;
		menu = null;
		if (!row) return;
		const node = row.node;
		switch (action) {
			case 'open':
				return node.type === 'file' ? onopen?.(node.id) : undefined;
			case 'newfile':
				return node.type === 'folder' ? store.newFileIn(node.path) : undefined;
			case 'newfolder':
				return node.type === 'folder' ? store.newFolderIn(node.path) : undefined;
			case 'siblings':
				return node.type === 'folder' ? store.collapseSiblings(node.path) : undefined;
			case 'main':
				return node.type === 'file' ? onsetmain?.(node.id) : undefined;
			case 'duplicate':
				return store.duplicateSelected();
			case 'copy':
				return oncopypath?.(relOf(row));
			case 'rename':
				return startRename(row);
			case 'delete':
				return store.deleteSelected();
			case 'download':
				return node.type === 'folder'
					? ondownloadfolder?.(node.path)
					: ondownloadfile?.(node.id);
		}
	}
</script>

<div bind:this={listEl} role="tree" aria-label="Project files" aria-multiselectable="true">
	{#each rows as row (row.key)}
		{@const node = row.node}
		{@const folder = node.type === 'folder'}
		{@const selected = store.isSelected(row.key)}
		{@const active = !folder && node.id === activeId}
		{@const Icon = folder ? (row.expanded ? IconFolderOpen : IconFolder) : KIND_ICON[classifyFile(node.name)]}
		<div class="group/row relative flex items-center" role="none">
			<!-- One guide per ancestor level, aligned to that level's chevron. -->
			{#each Array.from({ length: row.depth }) as _, d (d)}
				<span
					aria-hidden="true"
					class="bg-border/70 pointer-events-none absolute inset-y-0 w-px"
					style:left={`${d * STEP + 15}px`}
				></span>
			{/each}

			{#if renamingKey === row.key}
				<div class="flex w-full items-center gap-1 py-1 pr-2" style:padding-left={indent(row.depth)}>
					<span class="w-[13px] shrink-0"></span>
					<Icon size={15} class="text-muted-foreground shrink-0" />
					<input
						bind:value={renameValue}
						class="bg-background border-ring text-foreground min-w-0 flex-1 rounded border px-1 py-0 text-sm outline-none"
						spellcheck="false"
						{@attach (el: HTMLInputElement) => selectBase(el, !folder)}
						onclick={(e) => e.stopPropagation()}
						onkeydown={(e) => {
							e.stopPropagation();
							if (e.key === 'Enter') commitRename();
							if (e.key === 'Escape') renamingKey = null;
						}}
						onblur={commitRename}
					/>
				</div>
			{:else}
				<button
					type="button"
					role="treeitem"
					data-key={row.key}
					tabindex={row.key === focusedKey ? 0 : -1}
					aria-level={row.depth + 1}
					aria-expanded={folder ? row.expanded : undefined}
					aria-selected={selected}
					aria-current={active ? 'true' : undefined}
					class="flex h-7 w-full items-center gap-1 rounded-md pr-7 text-left transition-colors {dragOverKey ===
					row.key
						? 'bg-brand-subtle ring-brand/40 ring-1 ring-inset'
						: selected
							? 'bg-accent text-accent-foreground font-medium'
							: active
								? 'text-foreground bg-accent/40'
								: row.dirty
									? 'text-foreground hover:bg-accent'
									: 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
					style:padding-left={indent(row.depth)}
					title={row.dirty && !folder ? `${node.name}: unsaved` : node.name}
					draggable="true"
					ondragstart={(e) => onDragStart(row, e)}
					ondragend={() => {
						setDrag(null);
						cancelSpring();
					}}
					ondragover={(e) => onDragOver(row, e)}
					ondragleave={onDragLeave}
					ondrop={(e) => onDrop(row, e)}
					oncontextmenu={(e) => openMenu(e, row)}
					onkeydown={(e) => onRowKeyDown(e, row)}
					onfocus={() => (store.focusedKey = row.key)}
					onclick={(e) => activate(row, { meta: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
				>
					<!-- Reserves the chevron column so files line up under their folder. -->
					<span class="w-[13px] shrink-0"></span>
					<Icon size={15} class="shrink-0 {folder ? 'text-muted-foreground' : ''}" />
					<span class="truncate">{node.name}</span>
					{#if !folder && node.id === mainId}
						<span
							class="bg-brand-subtle text-brand ml-1 shrink-0 rounded px-1 text-[10px] font-medium"
							title="Main file (compile target)"
						>
							main
						</span>
					{/if}
				</button>

				<!-- Its own hit target, over the row rather than inside it: a button cannot
				     nest in a button, and expanding must not also select. -->
				{#if folder}
					<button
						type="button"
						tabindex="-1"
						aria-label={row.expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
						class="text-muted-foreground hover:text-foreground absolute top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded"
						style:left={`${row.depth * STEP + 4}px`}
						onclick={(e) => {
							e.stopPropagation();
							if (e.altKey) store.collapseSiblings(node.path);
							else store.toggleFolder(node.path);
						}}
					>
						<IconChevronRight
							size={14}
							class="transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none {row.expanded
								? 'rotate-90'
								: ''}"
						/>
					</button>
				{/if}

				{#if row.dirty}
					<span
						class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 transition-opacity group-hover/row:opacity-0"
						title={folder ? 'Contains unsaved changes' : 'Unsaved changes'}
					>
						<span class="bg-foreground/60 block size-1.5 rounded-full"></span>
					</span>
				{/if}

				<!-- Kept as a real control, not hover-only: on touch there is no hover and
				     the context menu is unreachable. -->
				<button
					type="button"
					tabindex="-1"
					class="text-muted-foreground hover:bg-accent hover:text-foreground absolute top-1/2 right-1 grid size-5 -translate-y-1/2 place-items-center rounded opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100"
					title={folder ? 'Folder actions' : 'File actions'}
					aria-label={`Actions for ${node.name}`}
					onclick={(e) => openMenu(e, row)}
				>
					<IconDots size={16} />
				</button>
			{/if}
		</div>
	{/each}

	{#if store.draft}
		{@const depth = store.draft.dir ? store.draft.dir.split('/').length : 0}
		<div class="relative flex items-center" role="none">
			{#each Array.from({ length: depth }) as _, d (d)}
				<span
					aria-hidden="true"
					class="bg-border/70 pointer-events-none absolute inset-y-0 w-px"
					style:left={`${d * STEP + 15}px`}
				></span>
			{/each}
			<div class="flex w-full items-center gap-1 py-1 pr-2" style:padding-left={indent(depth)}>
				<span class="w-[13px] shrink-0"></span>
				{#if store.draft.kind === 'folder'}
					<IconFolder size={15} class="text-muted-foreground shrink-0" />
				{:else}
					<IconFileText size={15} class="text-muted-foreground shrink-0" />
				{/if}
				<input
					class="bg-background border-ring text-foreground min-w-0 flex-1 rounded border px-1 py-0 text-sm outline-none"
					placeholder={store.draft.kind === 'folder' ? 'Folder name' : 'file.tex'}
					spellcheck="false"
					{@attach (el: HTMLInputElement) => el.focus()}
					onkeydown={(e) => {
						e.stopPropagation();
						if (e.key === 'Enter') store.commitDraft(e.currentTarget.value);
						if (e.key === 'Escape') store.draft = null;
					}}
					onblur={(e) => store.commitDraft(e.currentTarget.value)}
				/>
			</div>
		</div>
	{/if}
</div>

{#if menu}
	{@const node = menu.row.node}
	<TreeMenu
		x={menu.x}
		y={menu.y}
		kind={node.type}
		count={store.selectedKeys.length || 1}
		canSetMain={Boolean(onsetmain) && node.type === 'file' && isTex(node.name)}
		isMain={node.type === 'file' && node.id === mainId}
		canDownload={node.type === 'folder' ? Boolean(ondownloadfolder) : Boolean(ondownloadfile)}
		canDuplicate={node.type === 'file'}
		onpick={runAction}
		onclose={() => (menu = null)}
	/>
{/if}
