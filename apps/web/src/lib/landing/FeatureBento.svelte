<script lang="ts">
	import RevisionStack from "$lib/illustrations/RevisionStack.svelte";
	import { REPO_SLUG } from "$lib/landing/nav-data";
	import {
		IconAlertTriangle,
		IconBrandGithub,
		IconCheck,
		IconCloudOff,
		IconFileZip,
		IconFolder,
		IconLock,
		IconPlane,
		IconWifiOff
	} from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";
</script>

{#snippet card(title: string, body: string, visual: Snippet, className = "")}
	<article
		class="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border text-card-foreground md:rounded-3xl {className}"
	>
		<div
			class="relative z-0 flex min-h-40 flex-1 items-center justify-center overflow-hidden p-4 md:p-6"
		>
			{@render visual()}
		</div>
		<div class="relative z-10 p-4 md:px-8 md:pb-6">
			<h3 class="mb-1 text-body font-medium text-foreground md:text-body-lg">{title}</h3>
			<p class="text-body text-muted-foreground md:text-body-lg">{body}</p>
		</div>
	</article>
{/snippet}

{#snippet stayLocal()}
	<div class="flex w-full max-w-sm flex-col items-center gap-3">
		<div class="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
			<span class="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
				<IconFolder class="size-5 text-foreground" aria-hidden="true" />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block truncate font-mono text-body font-medium text-foreground">thesis/main.tex</span>
				<span class="block text-caption text-muted-foreground">Saved in this browser</span>
			</span>
			<IconLock class="size-4 shrink-0 text-primary" aria-label="Stored locally" />
		</div>
		<span aria-hidden="true" class="h-8 border-l-2 border-dashed border-border"></span>
		<span
			class="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-caption font-medium text-muted-foreground"
		>
			<IconCloudOff class="size-3.5" aria-hidden="true" />
			Never uploaded to a server
		</span>
	</div>
{/snippet}

{#snippet offline()}
	<div
		class="flex w-full max-w-xs items-center justify-between gap-4 rounded-xl border border-border bg-card p-3 pl-4 shadow-sm"
	>
		<span class="flex items-center gap-2.5 text-body font-medium text-foreground">
			<IconPlane class="size-4 text-primary" aria-hidden="true" />
			Airplane mode
		</span>
		<span aria-hidden="true" class="relative h-6 w-10 rounded-full bg-primary">
			<span class="absolute top-0.5 right-0.5 size-5 rounded-full bg-fixed-light shadow-sm"></span>
		</span>
	</div>
	<span
		class="absolute top-4 right-4 flex items-center gap-1.5 text-caption font-medium text-muted-foreground md:top-5 md:right-5"
	>
		<IconWifiOff class="size-3.5" aria-hidden="true" />
		No internet
	</span>
{/snippet}

{#snippet history()}
	<RevisionStack class="max-h-80 max-w-56" />
{/snippet}

{#snippet errors()}
	<div class="flex w-full max-w-sm flex-col gap-2">
		<div class="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
			<IconAlertTriangle class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
			<span class="min-w-0 flex-1">
				<span class="block text-body font-medium text-foreground">
					<span class="sr-only">Error:</span> Undefined control sequence
				</span>
				<span class="block font-mono text-caption text-muted-foreground">chapters/results.tex, line 48</span>
			</span>
		</div>
		<div
			class="rounded-xl border border-border bg-card px-3 py-2 font-mono text-caption text-muted-foreground"
			aria-hidden="true"
		>
			<span class="text-foreground">48</span>
			<span class="ml-3 border-b-2 border-dashed border-destructive text-foreground">\sectoin</span>&#123;Results&#125;
		</div>
	</div>
{/snippet}

{#snippet importZip()}
	<div class="flex w-full max-w-xs items-center gap-3">
		<span
			class="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-3 text-body font-medium text-foreground shadow-sm"
		>
			<IconFileZip class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<span class="truncate">overleaf.zip</span>
		</span>
		<span aria-hidden="true" class="w-6 border-t-2 border-dashed border-border"></span>
		<span
			class="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-3 text-body font-medium text-foreground shadow-sm"
		>
			<IconCheck class="size-4 shrink-0 text-primary" aria-hidden="true" />
			<span class="truncate">Opened</span>
		</span>
	</div>
{/snippet}

{#snippet openSource()}
	<div class="relative w-full max-w-xs rounded-xl border border-border bg-card p-4 shadow-sm">
		<span class="flex items-center gap-2 text-caption text-muted-foreground">
			<IconBrandGithub class="size-3.5" aria-hidden="true" />
			github.com
		</span>
		<span class="mt-1 block truncate font-mono text-body font-medium text-foreground">{REPO_SLUG}</span>
		<span
			class="absolute -top-3 -right-3 flex rotate-6 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-caption font-semibold text-primary shadow-sm"
		>
			<IconCheck class="size-3.5" aria-hidden="true" />
			GPLv3
		</span>
	</div>
{/snippet}

<div class="mx-auto grid w-full grid-cols-1 gap-2 md:gap-4 lg:min-h-[calc(100svh-6.5rem)] lg:grid-cols-12">
	<div class="grid min-h-0 grid-cols-1 gap-2 md:gap-4 lg:col-span-4 lg:grid-rows-[6fr_4fr]">
		{@render card(
			'Your drafts stay yours',
			'Projects live in your browser on your own device. Nothing is uploaded or stored by us.',
			stayLocal
		)}
		{@render card(
			'Compiles with the network off',
			'Download the engine once, then write and build on a plane or a train.',
			offline
		)}
	</div>

	{@render card(
		'Every revision, kept',
		'Built-in Git keeps your full history, free. Push to GitHub, GitLab or your university server.',
		history,
		'lg:col-span-3'
	)}

	<div class="grid min-h-0 grid-cols-1 gap-2 md:gap-4 lg:col-span-5 lg:grid-rows-[5fr_5fr]">
		{@render card(
			'Errors point at the line',
			'The log is read for you, so each problem links straight to the file and line that caused it.',
			errors
		)}
		<div class="grid min-h-0 grid-cols-1 gap-2 md:grid-cols-2 md:gap-4">
			{@render card('Bring your Overleaf project', 'Drop the exported .zip and keep writing.', importZip)}
			{@render card('Built in the open', 'Read the code, report a bug, send a fix.', openSource)}
		</div>
	</div>
</div>
