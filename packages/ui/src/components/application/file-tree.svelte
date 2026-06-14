<script lang="ts" module>
	export type TreeFile = { type: 'file'; id: string; name: string };
	export type TreeFolder = { type: 'folder'; name: string; path: string; children: TreeNode[] };
	export type TreeNode = TreeFile | TreeFolder;
</script>

<script lang="ts">
	import Self from './file-tree.svelte';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '@glyphx/ui/dropdown-menu';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import {
		IconFilePlus,
		IconFileText,
		IconFolder,
		IconFolderOpen,
		IconFolderPlus,
		IconChevronRight,
		IconDots,
		IconPencil,
		IconTrash,
		IconTargetArrow
	} from '@tabler/icons-svelte';
	import { canDropInto, getDrag, setDrag } from './file-dnd';

	/**
	 * FileTree — recursive Explorer tree. Folders expand/collapse with a smooth
	 * `slide`; files and folders are draggable and folders are drop targets, so
	 * items move between folders (nested) exactly like VS Code. Both files and
	 * folders carry a ⋯ menu (rename inline / delete; files also set-as-main).
	 * The compile target (`mainId`) shows a "main" badge. Open-state is local per
	 * folder (default open). Indentation is depth-driven.
	 */
	let {
		nodes,
		activeId = '',
		mainId = null,
		selectedPath = null,
		dirtyIds = new Set(),
		gitStatus = {},
		depth = 0,
		open = $bindable({}),
		onopen,
		onselectfolder,
		onrename,
		ondelete,
		onsetmain,
		onmovefile,
		onmovefolder,
		onrenamefolder,
		ondeletefolder,
		onnewfilein,
		onnewfolderin
	}: {
		nodes: TreeNode[];
		activeId?: string;
		/** Id of the project's main (compile-target) file. */
		mainId?: string | null;
		/** Path of the currently-selected folder (highlighted like the active file). */
		selectedPath?: string | null;
		/** Ids of files with unsaved edits (rendered as a "modified" dot). */
		dirtyIds?: Set<string>;
		/** File id → Git status word ("modified" / "untracked" / …) for the M/U/A badge. */
		gitStatus?: Record<string, string>;
		depth?: number;
		open?: Record<string, boolean>;
		onopen?: (id: string) => void;
		/** A folder row was clicked — report its path so the host can track selection. */
		onselectfolder?: (path: string) => void;
		/** Rename a file — receives the new leaf name (folder prefix is preserved upstream). */
		onrename?: (id: string, name: string) => void;
		ondelete?: (id: string) => void;
		/** Mark a file as the compile target. Omitted when there's no project. */
		onsetmain?: (id: string) => void;
		/** Move a file into `targetDir` ('' = root). */
		onmovefile?: (id: string, targetDir: string) => void;
		/** Move a folder into `targetDir` ('' = root). */
		onmovefolder?: (path: string, targetDir: string) => void;
		/** Rename a folder — receives the new leaf name. */
		onrenamefolder?: (path: string, name: string) => void;
		ondeletefolder?: (path: string) => void;
		/** Create a new file inside `dir`. */
		onnewfilein?: (dir: string) => void;
		/** Create a new subfolder inside `dir`. */
		onnewfolderin?: (dir: string) => void;
	} = $props();

	const isTex = (name: string) => /\.tex$/i.test(name);

	const isOpen = (path: string) => open[path] ?? true;
	const toggle = (path: string) => (open[path] = !isOpen(path));
	const indent = (d: number) => `${d * 12 + 8}px`;

	let renamingId = $state<string | null>(null);
	let renamingPath = $state<string | null>(null);
	let renameValue = $state('');
	let dragOverPath = $state<string | null>(null);

	function startRename(node: TreeFile) {
		renamingId = node.id;
		renameValue = node.name;
	}
	function commitRename(id: string) {
		const name = renameValue.trim();
		if (name) onrename?.(id, name);
		renamingId = null;
	}
	function startRenameFolder(node: TreeFolder) {
		renamingPath = node.path;
		renameValue = node.name;
	}
	function commitRenameFolder(path: string) {
		const name = renameValue.trim();
		if (name) onrenamefolder?.(path, name);
		renamingPath = null;
	}

	// --- Drag & drop ---
	function dragStartFile(node: TreeFile, e: DragEvent) {
		setDrag({ kind: 'file', id: node.id, name: node.name });
		e.dataTransfer?.setData('text/plain', node.name);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function dragStartFolder(node: TreeFolder, e: DragEvent) {
		setDrag({ kind: 'folder', path: node.path, name: node.name });
		e.dataTransfer?.setData('text/plain', node.path);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function dragOverFolder(path: string, e: DragEvent) {
		if (!getDrag()) return;
		const ok = canDropInto(path);
		e.preventDefault();
		e.stopPropagation(); // innermost folder only — no double highlight up the tree
		if (e.dataTransfer) e.dataTransfer.dropEffect = ok ? 'move' : 'none';
		dragOverPath = ok ? path : null;
	}
	const endDrag = () => setDrag(null);
	function dropOnFolder(path: string, e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragOverPath = null;
		const it = getDrag();
		setDrag(null);
		if (!it || !canDropInto(path)) return;
		if (it.kind === 'file') onmovefile?.(it.id, path);
		else onmovefolder?.(it.path, path);
	}

	// --- Change indicators (VS Code parity) — unsaved dot + Git M/U/A badge. ---
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
	// A folder is "changed" when any descendant file is dirty or Git-tracked-dirty.
	function folderChanged(n: TreeNode): boolean {
		if (n.type === 'file') return dirtyIds.has(n.id) || !!gitStatus[n.id];
		return n.children.some(folderChanged);
	}
</script>

{#each nodes as node (node.type === 'folder' ? `d:${node.path}` : `f:${node.id}`)}
	{#if node.type === 'folder'}
		<div class="group/row relative flex items-center">
			{#if renamingPath === node.path}
				<div class="flex w-full items-center gap-1 py-1 pr-2" style:padding-left={indent(depth)}>
					<span class="w-[13px] shrink-0"></span>
					<IconFolder size={15} class="text-muted-foreground shrink-0" />
					<!-- svelte-ignore a11y_autofocus -->
					<input
						bind:value={renameValue}
						class="bg-background border-ring text-foreground min-w-0 flex-1 rounded border px-1 py-0 text-[13px] outline-none"
						autofocus
						spellcheck="false"
						onclick={(e) => e.stopPropagation()}
						onkeydown={(e) => {
							if (e.key === 'Enter') commitRenameFolder(node.path);
							if (e.key === 'Escape') renamingPath = null;
						}}
						onblur={() => commitRenameFolder(node.path)}
					/>
				</div>
			{:else}
				<button
					class="flex w-full items-center gap-1 rounded py-1 pr-7 text-left transition-colors {dragOverPath ===
					node.path
						? 'bg-brand-subtle ring-brand/40 ring-1 ring-inset'
						: node.path === selectedPath
							? 'bg-accent text-accent-foreground'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					style:padding-left={indent(depth)}
					aria-expanded={isOpen(node.path)}
					aria-current={node.path === selectedPath}
					draggable="true"
					ondragstart={(e) => dragStartFolder(node, e)}
					ondragend={endDrag}
					ondragover={(e) => dragOverFolder(node.path, e)}
					ondragleave={() => (dragOverPath = null)}
					ondrop={(e) => dropOnFolder(node.path, e)}
					onclick={() => {
						onselectfolder?.(node.path);
						toggle(node.path);
					}}
				>
					<IconChevronRight
						size={13}
						class="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] {isOpen(
							node.path
						)
							? 'rotate-90'
							: ''}"
					/>
					{#if isOpen(node.path)}
						<IconFolderOpen size={15} class="text-muted-foreground shrink-0" />
					{:else}
						<IconFolder size={15} class="text-muted-foreground shrink-0" />
					{/if}
					<span class="truncate">{node.name}</span>
				</button>

				{#if folderChanged(node) && node.path !== selectedPath}
					<span
						class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 transition-opacity group-hover/row:opacity-0"
						title="Contains changes"
					>
						<span class="bg-warning/80 block size-1.5 rounded-full"></span>
					</span>
				{/if}

				<DropdownMenu>
					<DropdownMenuTrigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 right-1 grid size-5 -translate-y-1/2 place-items-center rounded opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
								title="Folder actions"
								aria-label="Folder actions"
								onclick={(e: MouseEvent) => e.stopPropagation()}
							>
								<IconDots size={14} />
							</button>
						{/snippet}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" class="w-44">
						<DropdownMenuItem onSelect={() => onnewfilein?.(node.path)}>
							<IconFilePlus class="text-muted-foreground" /> New file
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => onnewfolderin?.(node.path)}>
							<IconFolderPlus class="text-muted-foreground" /> New folder
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => startRenameFolder(node)}>
							<IconPencil class="text-muted-foreground" /> Rename
						</DropdownMenuItem>
						<DropdownMenuItem variant="destructive" onSelect={() => ondeletefolder?.(node.path)}>
							<IconTrash /> Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			{/if}
		</div>
		{#if isOpen(node.path)}
			<div transition:slide={{ duration: 200, easing: cubicOut }}>
				<Self
					nodes={node.children}
					{activeId}
					{mainId}
					{selectedPath}
					{dirtyIds}
					{gitStatus}
					depth={depth + 1}
					bind:open
					{onopen}
					{onselectfolder}
					{onrename}
					{ondelete}
					{onsetmain}
					{onmovefile}
					{onmovefolder}
					{onrenamefolder}
					{ondeletefolder}
					{onnewfilein}
					{onnewfolderin}
				/>
			</div>
		{/if}
	{:else}
		{@const dirty = dirtyIds.has(node.id)}
		{@const status = gitStatus[node.id]}
		<div class="group/row relative flex items-center">
			{#if renamingId === node.id}
				<div class="flex w-full items-center gap-1 py-1 pr-2" style:padding-left={indent(depth)}>
					<span class="w-[13px] shrink-0"></span>
					<IconFileText size={15} class="text-muted-foreground shrink-0" />
					<!-- svelte-ignore a11y_autofocus -->
					<input
						bind:value={renameValue}
						class="bg-background border-ring text-foreground min-w-0 flex-1 rounded border px-1 py-0 text-[13px] outline-none"
						autofocus
						spellcheck="false"
						onclick={(e) => e.stopPropagation()}
						onkeydown={(e) => {
							if (e.key === 'Enter') commitRename(node.id);
							if (e.key === 'Escape') renamingId = null;
						}}
						onblur={() => commitRename(node.id)}
					/>
				</div>
			{:else}
				<button
					class="flex w-full items-center gap-1 rounded py-1 pr-7 text-left transition-colors {node.id ===
					activeId
						? 'bg-accent text-accent-foreground'
						: dirty || status
							? 'text-foreground hover:bg-muted'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					style:padding-left={indent(depth)}
					aria-current={node.id === activeId}
					title={dirty ? `${node.name} — unsaved` : node.name}
					draggable="true"
					ondragstart={(e) => dragStartFile(node, e)}
					ondragend={endDrag}
					onclick={() => onopen?.(node.id)}
					ondblclick={() => startRename(node)}
				>
					<span class="w-[13px] shrink-0"></span>
					<IconFileText size={15} class="shrink-0 {node.id === activeId ? 'text-brand' : ''}" />
					<span class="truncate">{node.name}</span>
					{#if node.id === mainId}
						<span
							class="bg-brand-subtle text-brand ml-1 shrink-0 rounded px-1 text-[9px] font-semibold tracking-wide uppercase"
							title="Main file (compile target)"
						>
							main
						</span>
					{/if}
				</button>

				{#if dirty || status}
					<span
						class="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 items-center transition-opacity group-hover/row:opacity-0"
						title={dirty ? 'Unsaved changes' : 'Modified'}
					>
						{#if dirty}
							<span class="bg-brand block size-1.5 rounded-full"></span>
						{:else}
							<span class="font-mono text-[10px] leading-none {STATUS_CLASS[status] ?? ''}"
								>{STATUS_LABEL[status] ?? '?'}</span
							>
						{/if}
					</span>
				{/if}

				<DropdownMenu>
					<DropdownMenuTrigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 right-1 grid size-5 -translate-y-1/2 place-items-center rounded opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
								title="File actions"
								aria-label="File actions"
								onclick={(e: MouseEvent) => e.stopPropagation()}
							>
								<IconDots size={14} />
							</button>
						{/snippet}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" class="w-40">
						{#if onsetmain && isTex(node.name) && node.id !== mainId}
							<DropdownMenuItem onSelect={() => onsetmain?.(node.id)}>
								<IconTargetArrow class="text-muted-foreground" /> Set as main
							</DropdownMenuItem>
						{/if}
						<DropdownMenuItem onSelect={() => startRename(node)}>
							<IconPencil class="text-muted-foreground" /> Rename
						</DropdownMenuItem>
						<DropdownMenuItem variant="destructive" onSelect={() => ondelete?.(node.id)}>
							<IconTrash /> Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			{/if}
		</div>
	{/if}
{/each}
