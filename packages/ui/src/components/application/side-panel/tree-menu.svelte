<script lang="ts" module>
	export type TreeAction =
		| 'open'
		| 'newfile'
		| 'newfolder'
		| 'main'
		| 'duplicate'
		| 'copy'
		| 'rename'
		| 'delete'
		| 'download'
		| 'siblings';
</script>

<script lang="ts">
	import {
		IconCopy,
		IconDownload,
		IconFilePlus,
		IconFolderPlus,
		IconFold,
		IconPencil,
		IconTarget,
		IconTrash,
		IconX
	} from '@tabler/icons-svelte';

	/** Right-click menu for a tree row. Anchored at the pointer, like every other
	 *  context menu on the platform. */
	let {
		x,
		y,
		kind,
		count,
		canSetMain,
		isMain,
		canDownload,
		canDuplicate,
		onpick,
		onclose
	}: {
		x: number;
		y: number;
		kind: 'file' | 'folder';
		/** How many rows the action applies to. >1 hides the single-row items. */
		count: number;
		canSetMain: boolean;
		isMain: boolean;
		canDownload: boolean;
		canDuplicate: boolean;
		onpick: (action: TreeAction) => void;
		onclose: () => void;
	} = $props();

	type Row =
		| { type: 'separator' }
		| {
				type?: undefined;
				id: TreeAction;
				label: string;
				icon?: typeof IconX;
				disabled?: boolean;
				destructive?: boolean;
		  };

	const many = $derived(count > 1);

	const ROWS = $derived(
		[
			...(many
				? []
				: kind === 'folder'
					? [
							{ id: 'newfile' as const, label: 'New file', icon: IconFilePlus },
							{ id: 'newfolder' as const, label: 'New folder', icon: IconFolderPlus },
							{ id: 'siblings' as const, label: 'Collapse siblings', icon: IconFold },
							{ type: 'separator' as const }
						]
					: [
							...(canSetMain
								? [
										{
											id: 'main' as const,
											label: isMain ? 'Main file' : 'Set as main file',
											icon: IconTarget,
											disabled: isMain
										}
									]
								: []),
							...(canDuplicate
								? [{ id: 'duplicate' as const, label: 'Duplicate', icon: IconCopy }]
								: []),
							{ type: 'separator' as const }
						]),
			...(many ? [] : [{ id: 'copy' as const, label: 'Copy path', icon: IconCopy }]),
			...(canDownload
				? [
						{
							id: 'download' as const,
							label: kind === 'folder' ? 'Download as .zip' : 'Download',
							icon: IconDownload
						}
					]
				: []),
			...(many ? [] : [{ id: 'rename' as const, label: 'Rename', icon: IconPencil }]),
			{
				id: 'delete' as const,
				label: many ? `Delete ${count} items` : kind === 'folder' ? 'Delete folder' : 'Delete',
				icon: IconTrash,
				destructive: true
			}
		] satisfies Row[]
	);

	const WIDTH = 208;
	const height = $derived(ROWS.reduce((sum, row) => sum + (row.type === 'separator' ? 5 : 28), 8));
	const left = $derived(Math.max(8, Math.min(x, window.innerWidth - WIDTH - 8)));
	const top = $derived(y + height > window.innerHeight ? Math.max(8, y - height) : y);

	let menu = $state<HTMLElement>();

	$effect(() => {
		menu?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
	});

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onclose();
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const buttons = [...(menu?.querySelectorAll('button:not([disabled])') ?? [])];
		const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next = (at + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
		(buttons[next] as HTMLButtonElement | undefined)?.focus();
	}
</script>

<div
	class="fixed inset-0 z-40"
	role="presentation"
	oncontextmenu={(e) => {
		e.preventDefault();
		onclose();
	}}
	onpointerdown={onclose}
></div>

<div
	bind:this={menu}
	class="border-border bg-popover glyphtex-tree-menu fixed z-50 rounded-lg border p-1 shadow-lg"
	style:left="{left}px"
	style:top="{top}px"
	style:width="{WIDTH}px"
	role="menu"
	tabindex="-1"
	aria-label={kind === 'folder' ? 'Folder actions' : 'File actions'}
	onkeydown={onKeyDown}
>
	{#each ROWS as row, i (row.type === 'separator' ? `sep-${i}` : row.id)}
		{#if row.type === 'separator'}
			<div class="bg-border/70 my-1 h-px" role="separator"></div>
		{:else}
			{@const Icon = row.icon}
			<button
				type="button"
				role="menuitem"
				disabled={row.disabled}
				class="flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[0.8125rem] outline-none disabled:pointer-events-none disabled:opacity-40 {row.destructive
					? 'text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10'
					: 'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground'}"
				onclick={() => onpick(row.id)}
			>
				{#if Icon}
					<Icon size={14} class="shrink-0" />
				{:else}
					<span class="size-3.5 shrink-0"></span>
				{/if}
				<span class="min-w-0 flex-1 truncate">{row.label}</span>
			</button>
		{/if}
	{/each}
</div>

<style>
	/* Menus are seen occasionally, so an entrance earns its place. Scales from the
	   pointer, not the centre, because that is where it came from. */
	.glyphtex-tree-menu {
		transform-origin: top left;
		animation: tree-menu-in 140ms cubic-bezier(0.23, 1, 0.32, 1);
	}
	@keyframes tree-menu-in {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.glyphtex-tree-menu {
			animation: none;
		}
	}
</style>
