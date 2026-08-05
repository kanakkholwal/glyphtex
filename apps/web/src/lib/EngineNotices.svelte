<script lang="ts">
	import type { PackDefinition } from 'glyphtex-engine';
	import { Button } from '@glyphtex/ui/button';
	import { IconBrandGithub, IconRefresh } from '@tabler/icons-svelte';
	import { BIBTEX_BACKEND_FIX } from '$lib/citations';
	import { REPO_URL } from '$lib/landing/nav-data';

	let {
		missingPacks = [],
		unsupportedFiles = [],
		requiresBiber = false,
		installing = false,
		updateAvailable = false,
		error,
		onadd,
		onupdate
	}: {
		missingPacks?: PackDefinition[];
		unsupportedFiles?: string[];
		/** biblatex left on its default backend; Biber is Perl and cannot run here. */
		requiresBiber?: boolean;
		installing?: boolean;
		/** A newer build is deployed and waiting; offer a one-click refresh. */
		updateAvailable?: boolean;
		error?: string;
		onadd?: () => void;
		onupdate?: () => void;
	} = $props();

	const packSizeMB = $derived((missingPacks.reduce((n, p) => n + p.bytes, 0) / 1048576).toFixed(2));

	// Pre-fill a GitHub issue so a support request is one click, not a blank form.
	// The unsupported names are the whole point of the report, so they lead the body.
	const issueUrl = $derived.by(() => {
		const names = unsupportedFiles.join(', ');
		const title = `Package support: ${names}`;
		const body = [
			'These files were requested by a document but no package set provides them:',
			'',
			...unsupportedFiles.map((f) => `- \`${f}\``),
			'',
			'<!-- Anything about the document that would help (class, other packages)? -->'
		].join('\n');
		const params = new URLSearchParams({ title, body, labels: 'package-support' });
		return `${REPO_URL}/issues/new?${params.toString()}`;
	});
</script>

{#if updateAvailable}
	<div
		role="status"
		class="border-border bg-brand/10 text-foreground flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-xs"
	>
		<IconRefresh class="text-brand size-3.5" />
		<span class="font-medium">A new version of GlyphTeX is available.</span>
		<span class="text-muted-foreground">Your work is saved; refreshing takes a moment.</span>
		<Button size="sm" variant="outline" class="h-6 px-2 text-xs" onclick={onupdate}>Refresh</Button>
	</div>
{/if}

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
		class="border-border bg-muted/40 text-muted-foreground flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-xs"
	>
		<span class="text-foreground/70 font-medium">Unavailable packages</span>
		<span>
			No package set provides {unsupportedFiles.slice(0, 3).join(', ')}{unsupportedFiles.length > 3
				? ` and ${unsupportedFiles.length - 3} more`
				: ''}. These are not supported in the browser yet.
		</span>
		<Button
			size="sm"
			variant="outline"
			class="h-6 gap-1 px-2 text-xs"
			href={issueUrl}
			target="_blank"
			rel="noopener noreferrer"
		>
			<IconBrandGithub class="size-3.5" />
			Request support
		</Button>
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
