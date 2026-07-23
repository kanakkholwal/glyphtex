<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '@glyphtex/ui/dialog';
	import { IconFileText } from '@tabler/icons-svelte';

	let {
		open = $bindable(false),
		candidates = [],
		current,
		onchoose
	}: {
		open?: boolean;
		/** Plausible roots, best first. */
		candidates?: string[];
		current?: string;
		onchoose?: (path: string) => void;
	} = $props();

	let selected = $state('');

	// Re-seed whenever the dialog opens so a reopen does not keep a stale pick.
	$effect(() => {
		if (open) selected = current && candidates.includes(current) ? current : (candidates[0] ?? '');
	});

	function confirm() {
		if (selected) onchoose?.(selected);
		open = false;
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<IconFileText size={18} class="text-primary" />
				Which file is the main document?
			</DialogTitle>
			<DialogDescription class="leading-relaxed">
				This project has more than one file that could be compiled on its own. Pick the one that
				builds the whole document. You can change it later from the file list.
			</DialogDescription>
		</DialogHeader>

		<fieldset class="flex flex-col gap-1.5">
			<legend class="sr-only">Main document</legend>
			{#each candidates as path (path)}
				<label
					class="border-border hover:bg-muted/50 has-checked:border-primary has-checked:bg-primary/5 flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 transition-colors"
				>
					<input
						type="radio"
						name="main-file"
						value={path}
						bind:group={selected}
						class="accent-primary size-4 shrink-0"
					/>
					<span class="min-w-0 flex-1 truncate font-mono text-sm">{path}</span>
				</label>
			{/each}
		</fieldset>

		<div class="flex items-center justify-end gap-2">
			<Button size="sm" onclick={confirm} disabled={!selected}>Use this file</Button>
		</div>
	</DialogContent>
</Dialog>
