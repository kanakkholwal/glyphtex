<script lang="ts">
	import { IconFile, IconFileText, IconFileTypePdf, IconPhotoPlus } from '@tabler/icons-svelte';

	import { classifyFile, type FileKind } from '../file-kinds';
	import type { FileMeta } from './types';

	/** Files opened earlier in this session that no longer have a tab. */
	let { files = [], onopen }: { files?: FileMeta[]; onopen?: (id: string) => void } = $props();

	const icons: Record<FileKind, typeof IconFile> = {
		latex: IconFileText,
		markdown: IconFileText,
		text: IconFile,
		image: IconPhotoPlus,
		pdf: IconFileTypePdf,
		binary: IconFile
	};

	const leaf = (name: string) => name.slice(name.lastIndexOf('/') + 1);
</script>

<ul class="flex flex-col py-0.5">
	{#each files as file (file.id)}
		{@const Icon = icons[classifyFile(file.name)]}
		<li>
			<button
				class="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-1.5 rounded-md py-1 pr-2 pl-2.5 text-left transition-colors"
				title={file.name}
				onclick={() => onopen?.(file.id)}
			>
				<Icon size={14} class="shrink-0 opacity-70" />
				<span class="truncate text-sm">{leaf(file.name)}</span>
			</button>
		</li>
	{/each}
</ul>
