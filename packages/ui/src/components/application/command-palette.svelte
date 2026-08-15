<script lang="ts" module>
	export type PaletteFile = { id: string; name: string };
	export type PaletteCommand = {
		id: string;
		/** Menu it came from, shown as the row's trailing context ("View", "Edit"). */
		group: string;
		label: string;
		shortcut?: string;
		disabled?: boolean;
		run: () => void;
	};
</script>

<script lang="ts">
	import {
		CommandDialog,
		CommandEmpty,
		CommandGroup,
		CommandInput,
		CommandItem,
		CommandList,
		CommandSeparator
	} from '@glyphtex/ui/command';
	import { IconCornerDownLeft, IconFile, IconTerminal2 } from '@tabler/icons-svelte';

	/**
	 * Quick-open and command runner (⌘K / ⌘P). Files first, because switching file
	 * is the frequent case; every menu action is searchable below them, which is
	 * what let the File/Edit/View menu tree come out of the header.
	 */
	let {
		open = $bindable(false),
		files = [],
		commands = [],
		activeId = '',
		projectName = 'Project',
		onopen
	}: {
		open?: boolean;
		files?: PaletteFile[];
		commands?: PaletteCommand[];
		activeId?: string;
		projectName?: string;
		onopen?: (id: string) => void;
	} = $props();

	function choose(id: string) {
		onopen?.(id);
		open = false;
	}

	function runCommand(command: PaletteCommand) {
		if (command.disabled) return;
		open = false;
		command.run();
	}

	// Split a path into folder / file so each row reads like an explorer entry.
	function parts(name: string) {
		const i = name.lastIndexOf('/');
		return i === -1
			? { dir: '', base: name }
			: { dir: name.slice(0, i + 1), base: name.slice(i + 1) };
	}
</script>

<CommandDialog
	bind:open
	title="Go to file or run a command"
	description="Search files by name, or any command by what it does"
	class="sm:max-w-[34rem]"
>
	<CommandInput placeholder="Go to a file, or run a command…" />
	<CommandList>
		<CommandEmpty>Nothing matches</CommandEmpty>
		<CommandGroup heading={projectName}>
			{#each files as f (f.id)}
				{@const p = parts(f.name)}
				<CommandItem value={f.name} onSelect={() => choose(f.id)} class="gap-2.5 py-2">
					<IconFile class="text-muted-foreground shrink-0" />
					<span class="text-foreground truncate">{p.base}</span>
					{#if p.dir}
						<span class="text-faint truncate text-xs">{p.dir}</span>
					{/if}
					<!-- data-slot=command-shortcut suppresses the default check indicator
					     and keeps this group flush-right. -->
					<span data-slot="command-shortcut" class="ml-auto flex shrink-0 items-center gap-2">
						{#if f.id === activeId}
							<span class="text-faint text-xs">open</span>
						{/if}
						<IconCornerDownLeft
							size={14}
							class="text-faint opacity-0 transition-opacity group-data-[selected=true]/command-item:opacity-100"
						/>
					</span>
				</CommandItem>
			{/each}
		</CommandGroup>

		{#if commands.length}
			<CommandSeparator />
			<CommandGroup heading="Commands">
				{#each commands as command (command.id)}
					<!-- The group name is part of `value` so typing "view" finds every View
					     command, the way scanning the old menu did. -->
					<CommandItem
						value="{command.label} {command.group}"
						disabled={command.disabled}
						onSelect={() => runCommand(command)}
						class="gap-2.5 py-2"
					>
						<IconTerminal2 class="text-muted-foreground shrink-0" />
						<span class="text-foreground truncate">{command.label}</span>
						<span class="text-faint shrink-0 text-xs">{command.group}</span>
						<span data-slot="command-shortcut" class="ml-auto flex shrink-0 items-center gap-2">
							{#if command.shortcut}
								<span class="text-faint text-xs">{command.shortcut}</span>
							{/if}
							<IconCornerDownLeft
								size={14}
								class="text-faint opacity-0 transition-opacity group-data-[selected=true]/command-item:opacity-100"
							/>
						</span>
					</CommandItem>
				{/each}
			</CommandGroup>
		{/if}
	</CommandList>
</CommandDialog>
