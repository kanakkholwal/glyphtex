<script lang="ts" module>
	export type PaletteFile = { id: string; name: string };
</script>

<script lang="ts">
	import {
		CommandDialog,
		CommandEmpty,
		CommandGroup,
		CommandInput,
		CommandItem,
		CommandList
	} from '@glyphtex/ui/command';
	import { IconCornerDownLeft, IconFile } from '@tabler/icons-svelte';

	/**
	 * Quick-open (⌘/Ctrl+P) — jump between the document's files. Dialog only: its
	 * trigger is the file name in the header breadcrumb.
	 */
	let {
		open = $bindable(false),
		files = [],
		activeId = '',
		projectName = 'Project',
		onopen
	}: {
		open?: boolean;
		files?: PaletteFile[];
		activeId?: string;
		projectName?: string;
		onopen?: (id: string) => void;
	} = $props();

	function choose(id: string) {
		onopen?.(id);
		open = false;
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
	title="Go to file"
	description="Search files by name"
	class="sm:max-w-[34rem]"
>
	<CommandInput placeholder="Go to file by name…" />
	<CommandList>
		<CommandEmpty>No matching files</CommandEmpty>
		<CommandGroup heading={projectName}>
			{#each files as f (f.id)}
				{const p = parts(f.name)}
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
	</CommandList>
</CommandDialog>
