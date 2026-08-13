<script lang="ts">
	import {
		IconFile,
		IconFileText,
		IconFileTypePdf,
		IconPhotoPlus,
		IconPlus,
		IconX
	} from '@tabler/icons-svelte';

	import { classifyFile, type FileKind } from '../file-kinds';
	import { shortcutLabel } from '../shortcuts';
	import type { FileStore } from './files.svelte';
	import { baseName, parentDir } from './paths';

	let { files, onnew }: { files: FileStore; onnew?: () => void } = $props();

	const icons: Record<FileKind, typeof IconFile> = {
		latex: IconFileText,
		markdown: IconFileText,
		text: IconFile,
		image: IconPhotoPlus,
		pdf: IconFileTypePdf,
		binary: IconFile
	};

	// A middle-click closes the tab, matching every editor.
	function onPointerDown(event: PointerEvent, id: string): void {
		if (event.button === 1) {
			event.preventDefault();
			files.closeTab(id);
		}
	}
</script>

<div
	class="flex min-w-0 flex-1 items-stretch overflow-x-auto"
	role="tablist"
	aria-label="Open files"
>
	{#each files.openTabFiles as file (file.id)}
		{@const active = file.id === files.activeId}
		{@const dirty = files.dirtyIds.has(file.id)}
		{@const Icon = icons[classifyFile(file.name)]}
		{@const dir = /[\\/]/.test(file.name) ? parentDir(file.name) : ''}
		<div
			class="group border-border/70 relative flex shrink-0 items-center gap-1.5 border-r pr-1 pl-3 text-xs transition-colors {active
				? 'bg-background text-foreground'
				: 'text-muted-foreground hover:bg-background/50'}"
			role="presentation"
		>
			{#if active}
				<span class="bg-brand absolute inset-x-0 bottom-0 h-0.5" aria-hidden="true"></span>
			{/if}
			<button
				class="flex min-w-0 items-center gap-1.5 py-0 pr-1"
				role="tab"
				aria-selected={active}
				title={file.name}
				onclick={() => files.openFile(file.id)}
				onpointerdown={(e) => onPointerDown(e, file.id)}
			>
				<Icon size={14} class="shrink-0 opacity-70" />
				<span class="max-w-44 truncate">{baseName(file.name)}</span>
				{#if dir}
					<span class="text-faint hidden max-w-28 truncate lg:inline">{dir}</span>
				{/if}
			</button>
			<button
				class="hover:bg-muted grid size-5 shrink-0 place-items-center rounded transition-[background-color,opacity] {dirty
					? ''
					: 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}"
				title="Close (middle-click)"
				aria-label="Close {baseName(file.name)}"
				onclick={() => files.closeTab(file.id)}
			>
				{#if dirty}
					<span class="bg-foreground/60 group-hover:hidden size-1.5 rounded-full" aria-hidden="true"
					></span>
					<IconX size={13} class="hidden group-hover:block" />
				{:else}
					<IconX size={13} />
				{/if}
			</button>
		</div>
	{/each}

	{#if onnew}
		<button
			class="text-muted-foreground hover:bg-background/50 hover:text-foreground grid w-8 shrink-0 place-items-center transition-colors"
			title="New file ({shortcutLabel('new-file')})"
			aria-label="New file"
			onclick={() => onnew?.()}
		>
			<IconPlus size={15} />
		</button>
	{/if}
</div>
