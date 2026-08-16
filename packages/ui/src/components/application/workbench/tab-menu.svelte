<script lang="ts" module>
	export type TabAction =
		| "close"
		| "others"
		| "right"
		| "all"
		| "main"
		| "copy"
		| "reveal"
		| "split";
</script>

<script lang="ts">
	import {
		IconArrowBarToRight,
		IconCheck,
		IconCopy,
		IconFolderShare,
		IconTarget,
		IconX
	} from '@tabler/icons-svelte';

	/** Right-click menu for one open file. Anchored at the pointer, like every
	 *  other context menu on the platform. */
	let {
		x,
		y,
		canClose,
		hasOthers,
		hasRight,
		canSetMain,
		isMain,
		canReveal,
		onpick,
		onclose
	}: {
		x: number;
		y: number;
		canClose: boolean;
		hasOthers: boolean;
		hasRight: boolean;
		canSetMain: boolean;
		isMain: boolean;
		canReveal: boolean;
		onpick: (action: TabAction) => void;
		onclose: () => void;
	} = $props();

	type Row =
		| { type: 'separator' }
		| {
				type?: undefined;
				id: TabAction;
				label: string;
				icon?: typeof IconX;
				disabled?: boolean;
				checked?: boolean;
		  };

	const ROWS = $derived(
		[
			{ id: 'close' as const, label: 'Close', icon: IconX, disabled: !canClose },
			{ id: 'others' as const, label: 'Close others', disabled: !hasOthers },
			{
				id: 'right' as const,
				label: 'Close to the right',
				icon: IconArrowBarToRight,
				disabled: !hasRight
			},
			{ id: 'all' as const, label: 'Close all', disabled: !hasOthers },
			{ type: 'separator' as const },
			...(canSetMain
				? [
						{
							id: 'main' as const,
							label: isMain ? 'Main file' : 'Set as main file',
							icon: IconTarget,
							disabled: isMain,
							checked: isMain
						}
					]
				: []),
			{ id: 'copy' as const, label: 'Copy path', icon: IconCopy },
			...(canReveal
				? [{ id: 'reveal' as const, label: 'Reveal in file explorer', icon: IconFolderShare }]
				: [])
		] satisfies Row[]
	);

	const WIDTH = 208;
	const height = $derived(
		ROWS.reduce((sum, row) => sum + (row.type === 'separator' ? 5 : 28), 8)
	);
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
	class="border-border bg-popover glyphtex-tab-menu fixed z-50 rounded-lg border p-1 shadow-lg"
	style:left="{left}px"
	style:top="{top}px"
	style:width="{WIDTH}px"
	role="menu"
	tabindex="-1"
	aria-label="Open file actions"
	onkeydown={onKeyDown}
>
	{#each ROWS as row, i (row.type === 'separator' ? `sep-${i}` : row.id)}
		{#if row.type === 'separator'}
			<div class="bg-border/70 my-1 h-px" role="separator"></div>
		{:else}
			{@const Icon = row.icon}
			<button
				type="button"
				role={row.checked === undefined ? 'menuitem' : 'menuitemradio'}
				disabled={row.disabled}
				aria-checked={row.checked}
				class="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[0.8125rem] outline-none disabled:pointer-events-none disabled:opacity-40"
				onclick={() => onpick(row.id)}
			>
				{#if Icon}
					<Icon size={14} class="shrink-0" />
				{:else}
					<span class="size-3.5 shrink-0"></span>
				{/if}
				<span class="min-w-0 flex-1 truncate">{row.label}</span>
				{#if row.checked}
					<IconCheck size={13} class="text-brand shrink-0" />
				{/if}
			</button>
		{/if}
	{/each}
</div>

<style>
	/* Menus are seen occasionally, so an entrance earns its place. Scales from the
	   pointer, not the centre, because that is where it came from. */
	.glyphtex-tab-menu {
		transform-origin: top left;
		animation: tab-menu-in 140ms cubic-bezier(0.23, 1, 0.32, 1);
	}
	@keyframes tab-menu-in {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.glyphtex-tab-menu {
			animation: none;
		}
	}
</style>
