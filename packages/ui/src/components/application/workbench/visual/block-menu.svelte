<script lang="ts" module>
	export type BlockAction = "above" | "below" | "convert" | "source" | "delete";
</script>

<script lang="ts">
	import {
		IconCode,
		IconExchange,
		IconRowInsertBottom,
		IconRowInsertTop,
		IconTrash
	} from '@tabler/icons-svelte';

	/** The grip menu for one block. Everything that is not typing lives here, so the
	 *  gutter stays two small controls instead of a row of icons per block. */
	let {
		rect,
		canConvert,
		onpick,
		onclose
	}: {
		rect: DOMRect;
		canConvert: boolean;
		onpick: (action: BlockAction) => void;
		onclose: () => void;
	} = $props();

	const ITEMS = $derived(
		[
			{ id: 'above' as const, label: 'Insert above', icon: IconRowInsertTop, show: true },
			{ id: 'below' as const, label: 'Insert below', icon: IconRowInsertBottom, show: true },
			{ id: 'convert' as const, label: 'Turn into', icon: IconExchange, show: canConvert },
			{ id: 'source' as const, label: 'Edit LaTeX', icon: IconCode, show: true },
			{ id: 'delete' as const, label: 'Delete', icon: IconTrash, show: true }
		].filter((item) => item.show)
	);

	const WIDTH = 168;
	const height = $derived(ITEMS.length * 28 + 8);
	const left = $derived(Math.max(8, Math.min(rect.left, window.innerWidth - WIDTH - 8)));
	const top = $derived(
		rect.bottom + height > window.innerHeight ? Math.max(8, rect.top - height - 4) : rect.bottom + 4
	);

	let menu = $state<HTMLElement>();

	$effect(() => {
		menu?.querySelector('button')?.focus();
	});

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onclose();
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const buttons = [...(menu?.querySelectorAll('button') ?? [])];
		const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next = (at + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
		buttons[next]?.focus();
	}
</script>

<div class="fixed inset-0 z-40" role="presentation" onpointerdown={onclose}></div>

<div
	bind:this={menu}
	class="border-border bg-popover fixed z-50 rounded-lg border p-1 shadow-lg"
	style:left="{left}px"
	style:top="{top}px"
	style:width="{WIDTH}px"
	role="menu"
	tabindex="-1"
	aria-label="Block actions"
	onkeydown={onKeyDown}
>
	{#each ITEMS as item (item.id)}
		{@const Icon = item.icon}
		<button
			type="button"
			role="menuitem"
			class="text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[0.8125rem] outline-none focus-visible:bg-accent focus-visible:text-foreground {item.id ===
			'delete'
				? 'hover:text-destructive focus-visible:text-destructive'
				: ''}"
			onclick={() => onpick(item.id)}
		>
			<Icon size={14} class="shrink-0" />
			{item.label}
		</button>
	{/each}
</div>
