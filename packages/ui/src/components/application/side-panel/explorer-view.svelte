<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { IconChevronRight, IconFolder, IconPlus, IconSearch, IconX } from "@tabler/icons-svelte";
	import { slide } from "svelte/transition";

	import FileTree from "../file-tree.svelte";
	import { reveal } from "../motion";
	import type { SidePanelStore } from "./store.svelte";

	let {
		store,
		projectName,
		projectPath = null,
		activeId,
		mainId,
		onrenamefile,
		onsetmain,
		onrenamefolder,
		ondownloadfile,
		ondownloadfolder,
		oncopypath
	}: {
		store: SidePanelStore;
		projectName: string;
		/** Absolute folder backing the document (desktop). Absent on web. */
		projectPath?: string | null;
		activeId: string;
		mainId: string | null;
		onrenamefile?: (id: string, name: string) => void;
		onsetmain?: (id: string) => void;
		onrenamefolder?: (path: string, name: string) => void;
		ondownloadfile?: (id: string) => void;
		ondownloadfolder?: (path: string) => void;
		oncopypath?: (rel: string) => void;
	} = $props();

	let filterEl = $state<HTMLInputElement>();
</script>

{#if store.rootNodes.length > 0}
	<!-- Root header doubles as a drop target: dropping here moves items to the top level. -->
	<!-- Sentence case, not the old uppercase eyebrow: this is the project's name,
	     and a rail is not the place to shout it. -->
	<button
		class="text-muted-foreground flex h-7 w-full items-center gap-1 rounded-md px-1.5 text-xs font-medium transition-colors {store.rootDragOver
			? 'bg-primary/10 ring-primary/40 ring-1 ring-inset'
			: 'hover:bg-muted hover:text-foreground'}"
		aria-expanded={store.rootExpanded}
		ondragover={(e) => store.dragOverRoot(e)}
		ondragleave={() => (store.rootDragOver = false)}
		ondrop={(e) => store.rootDrop(e)}
		onclick={() => (store.rootExpanded = !store.rootExpanded)}
	>
		<IconChevronRight
			size={14}
			class="shrink-0 transition-transform duration-200 ease-craft motion-reduce:transition-none {store.rootExpanded
				? 'rotate-90'
				: ''}"
		/>
		<span class="truncate">{projectName}</span>
	</button>
	{#if projectPath}
		<p class="text-muted-foreground truncate px-1.5 pb-1 pl-6 text-xs" title={projectPath}>
			{projectPath}
		</p>
	{/if}
{/if}

{#if store.rootNodes.length === 0 && !store.draft}
	<div class="flex flex-col items-center gap-3 px-4 py-10 text-center">
		<div class="text-muted-foreground">
			<IconFolder size={40} stroke={1.25} />
		</div>
		<div class="flex flex-col gap-1">
			<p class="text-foreground text-sm font-medium">No files yet</p>
			<p class="text-muted-foreground text-xs leading-relaxed">
				Create a new file or upload to get started.
			</p>
		</div>
		<Button size="sm" onclick={() => store.createFileHere()}>
			<IconPlus /> New file
		</Button>
	</div>
{:else if store.rootExpanded}
	<div transition:slide={reveal()}>
		{#if store.showTreeFilter}
			<div class="relative px-0.5 pb-1">
				<IconSearch
					size={13}
					class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
				/>
				<input
					bind:this={filterEl}
					bind:value={store.treeFilter}
					class="bg-background border-border text-foreground placeholder:text-placeholder focus:border-ring h-7 w-full rounded-md border pr-7 pl-7 text-xs outline-none"
					placeholder="Filter files"
					spellcheck="false"
					aria-label="Filter files by name"
					onkeydown={(e) => {
						if (e.key === 'Escape') {
							store.treeFilter = '';
							filterEl?.blur();
						}
					}}
				/>
				{#if store.treeFilter}
					<button
						type="button"
						class="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 grid size-4 -translate-y-1/2 place-items-center rounded"
						aria-label="Clear filter"
						onclick={() => {
							store.treeFilter = '';
							filterEl?.focus();
						}}
					>
						<IconX size={12} />
					</button>
				{/if}
			</div>
		{/if}

		{#if store.treeFilter && store.rows.length === 0}
			<p class="text-muted-foreground px-3 py-6 text-center text-xs">
				Nothing matches “{store.treeFilter}”.
			</p>
		{/if}

		<FileTree
			{store}
			{activeId}
			{mainId}
			onopen={(id) => store.selectFile(id)}
			onrename={(id, name) => onrenamefile?.(id, name)}
			onsetmain={(id) => onsetmain?.(id)}
			{onrenamefolder}
			{ondownloadfile}
			{ondownloadfolder}
			{oncopypath}
		/>
	</div>
{/if}
