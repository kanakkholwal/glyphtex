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
		DropdownMenu,
		DropdownMenuCheckboxItem,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuShortcut,
		DropdownMenuSub,
		DropdownMenuSubContent,
		DropdownMenuSubTrigger,
		DropdownMenuTrigger
	} from '@glyphtex/ui/dropdown-menu';
	import type { Snippet } from 'svelte';

	/**
	 * The File / Edit / View / … menus collapsed behind one trigger, for chrome
	 * with no room for a horizontal menubar (the icon rail). Driven by the same
	 * `menus` config the controller builds, so the actions can't drift.
	 */
	let { menus, trigger }: { menus: Menu[]; trigger: Snippet<[{ props: Record<string, unknown> }]> } =
		$props();

	const isSep = (e: MenuEntry): e is MenuSeparator => e.type === 'separator';
</script>

<DropdownMenu>
	<DropdownMenuTrigger>
		{#snippet child({ props })}
			{@render trigger({ props })}
		{/snippet}
	</DropdownMenuTrigger>
	<!-- `align="end"` so it grows upward: the trigger sits at the foot of the rail. -->
	<DropdownMenuContent align="end" side="right" class="w-44">
		{#each menus as menu (menu.label)}
			<DropdownMenuSub>
				<DropdownMenuSubTrigger>{menu.label}</DropdownMenuSubTrigger>
				<DropdownMenuSubContent class="w-56">
					{#each menu.items as entry, j (j)}
						{#if isSep(entry)}
							<DropdownMenuSeparator />
						{:else if entry.checked !== undefined}
							<DropdownMenuCheckboxItem
								checked={entry.checked}
								disabled={entry.disabled}
								onCheckedChange={() => entry.run?.()}
							>
								{entry.label}
								{#if entry.shortcut}<DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut>{/if}
							</DropdownMenuCheckboxItem>
						{:else}
							<DropdownMenuItem disabled={entry.disabled} onSelect={() => entry.run?.()}>
								{entry.label}
								{#if entry.shortcut}<DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut>{/if}
							</DropdownMenuItem>
						{/if}
					{/each}
				</DropdownMenuSubContent>
			</DropdownMenuSub>
		{/each}
	</DropdownMenuContent>
</DropdownMenu>
