<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '@glyphtex/ui/dialog';
	import { toast } from '@glyphtex/ui/sonner';
	import {
		IconAlertTriangle,
		IconBrandGithub,
		IconCopy,
		IconPackage,
		IconRefresh,
		IconX
	} from '@tabler/icons-svelte';
	import type { PackDefinition } from 'glyphtex-engine';
	import { cubicOut } from 'svelte/easing';
	import { SvelteSet } from 'svelte/reactivity';
	import { fly } from 'svelte/transition';

	import { BIBTEX_BACKEND_FIX } from '$lib/citations';
	import { REPO_URL } from '$lib/landing/nav-data';
	import { buildSupportBody, supportIssueUrl } from '$lib/support-report';

	let {
		missingPacks = [],
		unsupportedFiles = [],
		requiresBiber = false,
		installing = false,
		updateAvailable = false,
		error,
		mainSource = '',
		fileCount,
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
		/** Main file's text. Only its `\usepackage`-class lines are ever read. */
		mainSource?: string;
		fileCount?: number;
		onadd?: () => void;
		onupdate?: () => void;
	} = $props();

	const packSizeMB = $derived((missingPacks.reduce((n, p) => n + p.bytes, 0) / 1048576).toFixed(2));

	// Dismissals are per-condition, so clearing one does not silence the next
	// compile's genuinely new notice.
	const dismissed = new SvelteSet<string>();
	const show = (id: string) => !dismissed.has(id);
	// A different set of unsupported files is a different notice.
	const unsupportedId = $derived(`unsupported:${unsupportedFiles.join(',')}`);
	const missingId = $derived(`missing:${missingPacks.map((p) => p.id).join(',')}`);

	let reportOpen = $state(false);
	const report = $derived({ unsupportedFiles, mainSource, fileCount });
	const reportBody = $derived(buildSupportBody(report));

	async function copyReport() {
		try {
			await navigator.clipboard.writeText(reportBody);
			toast.success('Report copied');
		} catch {
			toast.error('Could not copy: clipboard blocked');
		}
	}

	const card =
		'border-border bg-card text-foreground pointer-events-auto flex gap-2.5 rounded-lg border p-3 shadow-craft-lg';
</script>

<!-- Corner cards, not a banner strip. Each of these used to push the entire
     workbench down the moment a compile discovered it, so the editor and PDF
     jumped mid-session. `fixed` costs no layout. -->
<div
	class="pointer-events-none fixed right-4 bottom-4 z-40 flex w-[21rem] max-w-[calc(100vw-2rem)] flex-col gap-2"
	aria-live="polite"
>
	{#if updateAvailable}
		<div class={card} role="status" transition:fly={{ y: 8, duration: 180, easing: cubicOut }}>
			<IconRefresh class="text-brand mt-0.5 size-4 shrink-0" />
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium">A new version is available</p>
				<p class="text-muted-foreground mt-0.5 text-xs leading-relaxed">
					Your work is saved; refreshing takes a moment.
				</p>
				<Button size="sm" variant="outline" class="mt-2 h-7" onclick={onupdate}>Refresh</Button>
			</div>
		</div>
	{/if}

	{#if missingPacks.length > 0 && show(missingId)}
		<div class={card} role="status" transition:fly={{ y: 8, duration: 180, easing: cubicOut }}>
			<IconPackage class="text-muted-foreground mt-0.5 size-4 shrink-0" />
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium">Missing packages</p>
				<p class="text-muted-foreground mt-0.5 text-xs leading-relaxed">
					This document needs {missingPacks.map((p) => p.label).join(', ')} ({packSizeMB} MB).
				</p>
				{#if error}
					<p class="text-destructive mt-1 text-xs">{error}</p>
				{/if}
				<Button size="sm" class="mt-2 h-7" onclick={onadd} disabled={installing}>
					{installing ? 'Adding…' : 'Add packages'}
				</Button>
			</div>
			<Button
				variant="ghost"
				size="icon-sm"
				class="-mt-1 -mr-1"
				title="Dismiss"
				aria-label="Dismiss"
				onclick={() => dismissed.add(missingId)}
			>
				<IconX />
			</Button>
		</div>
	{/if}

	{#if unsupportedFiles.length > 0 && show(unsupportedId)}
		<div class={card} role="status" transition:fly={{ y: 8, duration: 180, easing: cubicOut }}>
			<IconAlertTriangle class="text-warning mt-0.5 size-4 shrink-0" />
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium">Unavailable packages</p>
				<p class="text-muted-foreground mt-0.5 text-xs leading-relaxed">
					No package set provides {unsupportedFiles
						.slice(0, 3)
						.join(', ')}{unsupportedFiles.length > 3
						? ` and ${unsupportedFiles.length - 3} more`
						: ''}. These aren't supported in the browser yet.
				</p>
				<Button
					size="sm"
					variant="outline"
					class="mt-2 h-7 gap-1.5"
					onclick={() => (reportOpen = true)}
				>
					<IconBrandGithub class="size-3.5" />
					Request support
				</Button>
			</div>
			<Button
				variant="ghost"
				size="icon-sm"
				class="-mt-1 -mr-1"
				title="Dismiss"
				aria-label="Dismiss"
				onclick={() => dismissed.add(unsupportedId)}
			>
				<IconX />
			</Button>
		</div>
	{/if}

	{#if requiresBiber && show('biber')}
		<div class={card} role="status" transition:fly={{ y: 8, duration: 180, easing: cubicOut }}>
			<IconAlertTriangle class="text-warning mt-0.5 size-4 shrink-0" />
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium">Bibliography not generated</p>
				<p class="text-muted-foreground mt-0.5 text-xs leading-relaxed">
					biblatex is set to Biber, which can't run in the browser. Use
					<code class="bg-muted rounded px-1 py-0.5">{BIBTEX_BACKEND_FIX}</code>
					to build it here. Citations show as [?] until then.
				</p>
			</div>
			<Button
				variant="ghost"
				size="icon-sm"
				class="-mt-1 -mr-1"
				title="Dismiss"
				aria-label="Dismiss"
				onclick={() => dismissed.add('biber')}
			>
				<IconX />
			</Button>
		</div>
	{/if}
</div>

<!-- Nothing is sent unseen. The report is built from an allowlist of preamble
     declarations, and this shows the finished text before GitHub opens. -->
<Dialog bind:open={reportOpen}>
	<DialogContent class="sm:max-w-xl">
		<DialogHeader>
			<DialogTitle>Request package support</DialogTitle>
			<DialogDescription>
				This is the whole report. Only the class and package declarations were copied from your
				document: no prose, data or file names.
			</DialogDescription>
		</DialogHeader>

		<pre
			class="border-border bg-muted/50 text-muted-foreground max-h-72 overflow-auto rounded-lg border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{reportBody}</pre>

		<DialogFooter>
			<Button variant="ghost" size="sm" class="gap-1.5" onclick={copyReport}>
				<IconCopy class="size-3.5" /> Copy
			</Button>
			<Button
				size="sm"
				class="gap-1.5"
				href={supportIssueUrl(REPO_URL, report)}
				target="_blank"
				rel="noopener noreferrer"
				onclick={() => (reportOpen = false)}
			>
				<IconBrandGithub class="size-3.5" /> Open GitHub issue
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
