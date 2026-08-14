<script lang="ts" module>
	export type MenuAction = {
		type?: 'item';
		label: string;
		shortcut?: string;
		checked?: boolean;
		disabled?: boolean;
		run?: () => void;
		/** Item edits the document: put the caret back in the editor on close,
		 *  instead of letting the menu return focus to its trigger. */
		refocusEditor?: boolean;
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
	 * The File / Edit / View / … menus collapsed behind one trigger. Driven by the
	 * same `menus` config the controller builds, so the actions can't drift.
	 */
	let {
		menus,
		trigger,
		align = 'start',
		side = 'bottom',
		focusEditor
	}: {
		menus: Menu[];
		trigger: Snippet<[{ props: Record<string, unknown> }]>;
		align?: 'start' | 'center' | 'end';
		side?: 'top' | 'right' | 'bottom' | 'left';
		/** Used by entries flagged `refocusEditor`. */
		focusEditor?: () => void;
	} = $props();

	const isSep = (e: MenuEntry): e is MenuSeparator => e.type === 'separator';

	// bits-ui returns focus to the trigger after close, which would strand the
	// caret on the menu button for items that just edited the document.
	let reclaimFocus = $state(false);
	function runEntry(entry: MenuAction) {
		if (entry.refocusEditor) reclaimFocus = true;
		entry.run?.();
	}
	function onCloseAutoFocus(event: Event) {
		if (!reclaimFocus) return;
		reclaimFocus = false;
		event.preventDefault();
		focusEditor?.();
	}
</script>

<DropdownMenu>
	<DropdownMenuTrigger>
		{#snippet child({ props })}
			{@render trigger({ props })}
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent {align} {side} class="w-44" {onCloseAutoFocus}>
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
								onCheckedChange={() => runEntry(entry)}
							>
								{entry.label}
								{#if entry.shortcut}<DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut
									>{/if}
							</DropdownMenuCheckboxItem>
						{:else}
							<DropdownMenuItem disabled={entry.disabled} onSelect={() => runEntry(entry)}>
								{entry.label}
								{#if entry.shortcut}<DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut
									>{/if}
							</DropdownMenuItem>
						{/if}
					{/each}
				</DropdownMenuSubContent>
			</DropdownMenuSub>
		{/each}
	</DropdownMenuContent>
</DropdownMenu>
