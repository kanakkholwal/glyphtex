<script lang="ts" module>
	export type MenuAction = {
		type?: 'item';
		label: string;
		shortcut?: string;
		checked?: boolean;
		disabled?: boolean;
		run?: () => void;
	};
	export type MenuSeparator = { type: 'separator' };
	export type MenuEntry = MenuAction | MenuSeparator;
	export type Menu = { label: string; items: MenuEntry[] };
</script>

<script lang="ts">
	import { IconCheck } from '@tabler/icons-svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	/**
	 * MenuBar — a VS Code-style application menu (File · Edit · View …). Click a
	 * top item to open it; once any menu is open, hovering another switches to it
	 * (the classic menubar feel). Driven entirely by a `menus` config so the host
	 * owns the actions. Calm, semantic-token chrome.
	 */
	let { menus }: { menus: Menu[] } = $props();

	let openIndex = $state<number | null>(null);
	let rootEl = $state<HTMLElement>();

	const isSep = (e: MenuEntry): e is MenuSeparator => e.type === 'separator';

	function toggle(i: number) {
		openIndex = openIndex === i ? null : i;
	}
	function hoverSwitch(i: number) {
		if (openIndex !== null) openIndex = i; // only switch when a menu is already open
	}
	function close() {
		openIndex = null;
	}

	$effect(() => {
		if (openIndex === null) return;
		const onDown = (e: MouseEvent) => {
			if (rootEl && !rootEl.contains(e.target as Node)) close();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
		};
		document.addEventListener('mousedown', onDown);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDown);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div bind:this={rootEl} class="flex items-center" role="menubar" aria-label="Application menu">
	{#each menus as menu, i (menu.label)}
		<div class="relative">
			<button
				class="flex h-7 items-center rounded-md px-2 text-[13px] transition-colors {openIndex === i
					? 'bg-muted text-foreground'
					: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
				role="menuitem"
				aria-haspopup="true"
				aria-expanded={openIndex === i}
				onclick={() => toggle(i)}
				onmouseenter={() => hoverSwitch(i)}
			>
				{menu.label}
			</button>

			{#if openIndex === i}
				<div
					class="border-border bg-popover text-popover-foreground shadow-craft-floating absolute top-full left-0 z-50 mt-1 min-w-56 rounded-lg border p-1"
					role="menu"
					transition:fly={{ y: -4, duration: 140, easing: cubicOut }}
				>
					{#each menu.items as entry, j (j)}
						{#if isSep(entry)}
							<div class="bg-border/70 my-1 h-px"></div>
						{:else}
							<button
								class="text-foreground hover:bg-muted disabled:hover:bg-transparent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
								role="menuitem"
								disabled={entry.disabled}
								onclick={() => {
									entry.run?.();
									close();
								}}
							>
								<span class="grid w-4 shrink-0 place-items-center">
									{#if entry.checked}<IconCheck size={14} class="text-brand" />{/if}
								</span>
								<span class="flex-1">{entry.label}</span>
								{#if entry.shortcut}
									<span class="text-muted-foreground/60 ml-6 font-mono text-[11px]">
										{entry.shortcut}
									</span>
								{/if}
							</button>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>
