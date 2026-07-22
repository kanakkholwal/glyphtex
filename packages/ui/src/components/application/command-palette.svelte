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
	} from '@glyphx/ui/command';
	import { IconChevronDown, IconCornerDownLeft, IconFile, IconStack2 } from '@tabler/icons-svelte';

	/**
	 * CommandPalette — the centre of the top bar. Shows the workspace name as a
	 * VS Code-style pill; clicking it (or ⌘/Ctrl+P) opens the native command
	 * dialog (cmdk: built-in filtering, keyboard nav, focus trap, portal) to jump
	 * between files.
	 */
	let {
		open = $bindable(false),
		files = [],
		activeId = '',
		projectName = 'Project',
		onopen,
		onrename,
		saving
	}: {
		open?: boolean;
		files?: PaletteFile[];
		activeId?: string;
		projectName?: string;
		onopen?: (id: string) => void;
		/** When set, the name pill becomes editable (double-click). */
		onrename?: (name: string) => void;
		/** When set, a persistence indicator sits beside the name. */
		saving?: boolean;
	} = $props();

	let editing = $state(false);
	let draft = $state('');
	let field = $state<HTMLInputElement>();

	function startRename(): void {
		if (!onrename) return;
		draft = projectName;
		editing = true;
		queueMicrotask(() => field?.select());
	}

	function commitRename(): void {
		editing = false;
		const next = draft.trim();
		if (next && next !== projectName) onrename?.(next);
	}

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

<!-- Centre: the workspace name (VS Code's command-centre slot). Doubles as a
     rename field on web, and opens quick-open (⌘P) otherwise. -->
<div
	class="border-border/60 bg-muted/30 flex h-8 w-72 max-w-[40vw] items-center gap-2 rounded-md border px-2.5 text-sm"
>
	<IconStack2 size={16} class="text-muted-foreground shrink-0 opacity-70" />
	{#if editing}
		<!-- svelte-ignore a11y_autofocus -->
		<input
			bind:this={field}
			bind:value={draft}
			autofocus
			class="text-foreground min-w-0 flex-1 bg-transparent font-medium focus:outline-none"
			onblur={commitRename}
			onkeydown={(e) => {
				if (e.key === 'Enter') commitRename();
				else if (e.key === 'Escape') editing = false;
			}}
			aria-label="Document name"
		/>
	{:else}
		<button
			class="text-foreground hover:text-foreground min-w-0 flex-1 truncate text-left font-medium"
			title={onrename ? 'Search files (⌘/Ctrl+P) · double-click to rename' : 'Search files (⌘/Ctrl+P)'}
			aria-haspopup="dialog"
			onclick={() => (open = true)}
			ondblclick={startRename}
		>
			{projectName}
		</button>
		{#if saving !== undefined}
			<span class="text-muted-foreground shrink-0 text-xs" aria-live="polite">
				{saving ? 'Saving…' : 'Saved'}
			</span>
		{:else}
			<IconChevronDown size={13} class="text-muted-foreground shrink-0 opacity-50" />
		{/if}
	{/if}
</div>

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
				{@const p = parts(f.name)}
				<CommandItem value={f.name} onSelect={() => choose(f.id)} class="gap-2.5 py-2">
					<IconFile class="text-muted-foreground shrink-0" />
					<span class="text-foreground truncate">{p.base}</span>
					{#if p.dir}
						<span class="text-muted-foreground/60 truncate text-xs">{p.dir}</span>
					{/if}
					<!-- data-slot=command-shortcut suppresses the default check indicator
					     and keeps this group flush-right. -->
					<span data-slot="command-shortcut" class="ml-auto flex shrink-0 items-center gap-2">
						{#if f.id === activeId}
							<span class="text-muted-foreground/50 text-xs">open</span>
						{/if}
						<IconCornerDownLeft
							size={13}
							class="text-muted-foreground/40 opacity-0 transition-opacity group-data-[selected=true]/command-item:opacity-100"
						/>
					</span>
				</CommandItem>
			{/each}
		</CommandGroup>
	</CommandList>
</CommandDialog>
