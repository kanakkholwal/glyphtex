<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from "@glyphtex/ui/dialog";
	import { IconFileText } from "@tabler/icons-svelte";

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

	// Writable derived: re-seeds whenever the dialog opens, so a reopen never keeps a stale pick.
	let selected = $derived(
		open && current && candidates.includes(current) ? current : (candidates[0] ?? "")
	);

	function confirm() {
		if (selected) onchoose?.(selected);
		open = false;
	}
</script>

<Dialog bind:open>
	<DialogContent class="gap-5 p-6 sm:max-w-md">
		<DialogHeader class="gap-3">
			<span
				class="border-border bg-card text-primary grid size-10 place-items-center rounded-lg border"
				aria-hidden="true"
			>
				<IconFileText size={20} />
			</span>
			<DialogTitle class="text-body-lg">Which file is the main document?</DialogTitle>
			<DialogDescription class="text-body">
				More than one file here could compile on its own. Pick the one that builds the whole
				document. You can change it later from the file list.
			</DialogDescription>
		</DialogHeader>

		<fieldset class="flex max-h-72 flex-col gap-2 overflow-y-auto">
			<legend class="sr-only">Main document</legend>
			{#each candidates as path (path)}
				<label
					class="border-border hover:bg-muted has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-ring flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors has-focus-visible:ring-2"
				>
					<input
						type="radio"
						name="main-file"
						value={path}
						checked={selected === path}
						onchange={() => (selected = path)}
						class="accent-primary size-4 shrink-0 outline-none"
					/>
					<span class="text-body min-w-0 flex-1 truncate font-mono">{path}</span>
				</label>
			{/each}
		</fieldset>

		<Button class="w-full sm:ml-auto sm:w-auto" onclick={confirm} disabled={!selected}>
			Use this file
		</Button>
	</DialogContent>
</Dialog>
