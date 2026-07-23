<script lang="ts">
	import type { PackDefinition } from 'glyphtex-engine';
	import { Button } from '@glyphtex/ui/button';
	import { BIBTEX_BACKEND_FIX } from '$lib/citations';

	let {
		missingPacks = [],
		unsupportedFiles = [],
		requiresBiber = false,
		installing = false,
		error,
		onadd
	}: {
		missingPacks?: PackDefinition[];
		unsupportedFiles?: string[];
		/** biblatex left on its default backend; Biber is Perl and cannot run here. */
		requiresBiber?: boolean;
		installing?: boolean;
		error?: string;
		onadd?: () => void;
	} = $props();

	const packSizeMB = $derived((missingPacks.reduce((n, p) => n + p.bytes, 0) / 1048576).toFixed(2));
</script>

{#if missingPacks.length > 0}
	<div
		role="status"
		class="border-border bg-muted/40 text-muted-foreground flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-xs"
	>
		<span class="text-foreground/70 font-medium">Missing packages</span>
		<span>
			This document needs {missingPacks.map((p) => p.label).join(', ')} ({packSizeMB} MB).
		</span>
		<Button
			size="sm"
			variant="outline"
			class="h-6 px-2 text-xs"
			onclick={onadd}
			disabled={installing}
		>
			{installing ? 'Adding…' : 'Add'}
		</Button>
		{#if error}
			<span class="text-destructive">{error}</span>
		{/if}
	</div>
{/if}

{#if unsupportedFiles.length > 0}
	<div
		role="status"
		class="border-border bg-muted/40 text-muted-foreground flex items-center gap-2 border-b px-3 py-1.5 text-xs"
	>
		<span class="text-foreground/70 font-medium">Unavailable packages</span>
		<span>
			No package set provides {unsupportedFiles.slice(0, 3).join(', ')}{unsupportedFiles.length > 3
				? ` and ${unsupportedFiles.length - 3} more`
				: ''}. These are not supported in the browser yet.
		</span>
	</div>
{/if}

{#if requiresBiber}
	<div
		role="status"
		class="border-border bg-muted/40 text-muted-foreground flex items-center gap-2 border-b px-3 py-1.5 text-xs"
	>
		<span class="text-foreground/70 font-medium">Bibliography not generated</span>
		<span>
			biblatex is set to Biber, which cannot run in the browser. Use
			<code class="bg-muted rounded px-1 py-0.5">{BIBTEX_BACKEND_FIX}</code>
			to build the bibliography here. Citations show as [?] until then.
		</span>
	</div>
{/if}
