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

	import type { Menu, MenuEntry, MenuSeparator } from './menu-bar.svelte';

	/**
	 * The File / Edit / View / … menus collapsed into one trigger, for chrome with
	 * no room for a horizontal menubar (the icon rail). Same `menus` config as
	 * {@link MenuBar}, so the two never drift.
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
	<DropdownMenuContent align="start" side="right" class="w-44">
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
