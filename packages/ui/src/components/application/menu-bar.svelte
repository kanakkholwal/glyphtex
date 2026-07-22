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
	import {
		Menubar,
		MenubarCheckboxItem,
		MenubarContent,
		MenubarItem,
		MenubarMenu,
		MenubarSeparator,
		MenubarShortcut,
		MenubarTrigger
	} from '@glyphtex/ui/menubar';

	/**
	 * MenuBar — the VS Code-style application menu (File · Edit · View …), a thin
	 * adapter over the native shadcn/bits-ui `Menubar` (keyboard nav, hover-to-
	 * switch, built-in open/close animation). Driven by a `menus` config so the
	 * host owns the actions; entries with a `checked` flag render as toggles.
	 */
	let { menus }: { menus: Menu[] } = $props();

	const isSep = (e: MenuEntry): e is MenuSeparator => e.type === 'separator';
</script>

<Menubar aria-label="Application menu">
	{#each menus as menu (menu.label)}
		<MenubarMenu>
			<MenubarTrigger>{menu.label}</MenubarTrigger>
			<MenubarContent>
				{#each menu.items as entry, j (j)}
					{#if isSep(entry)}
						<MenubarSeparator />
					{:else if entry.checked !== undefined}
						<MenubarCheckboxItem
							checked={entry.checked}
							disabled={entry.disabled}
							onCheckedChange={() => entry.run?.()}
						>
							{entry.label}
							{#if entry.shortcut}<MenubarShortcut>{entry.shortcut}</MenubarShortcut>{/if}
						</MenubarCheckboxItem>
					{:else}
						<MenubarItem disabled={entry.disabled} onSelect={() => entry.run?.()}>
							{entry.label}
							{#if entry.shortcut}<MenubarShortcut>{entry.shortcut}</MenubarShortcut>{/if}
						</MenubarItem>
					{/if}
				{/each}
			</MenubarContent>
		</MenubarMenu>
	{/each}
</Menubar>
