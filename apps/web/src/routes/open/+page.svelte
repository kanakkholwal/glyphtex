<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { Button } from "@glyphtex/ui/button";
	import { IconLoader2 } from "@tabler/icons-svelte";

	import CloudPage from "$lib/cloud/CloudPage.svelte";
	import { log } from "$lib/log";
	import { materialise } from "$lib/open/materialise";
	import type { OpenParse } from "$lib/open/request";

	let { data, form } = $props();

	const parsed = $derived<OpenParse | null>(form?.parsed ?? data.parsed);
	const formError = $derived(form && "error" in form ? (form.error as string) : undefined);
	let busy = $state(false);
	let failure = $state<string | undefined>(undefined);

	// Shown as plain text only: the source is untrusted and is never rendered as markup.
	const preview = $derived(
		parsed?.ok && parsed.request.source.kind === "snippet"
			? parsed.request.source.text.split("\n").slice(0, 30).join("\n")
			: ""
	);
	const host = $derived(
		parsed?.ok && parsed.request.source.kind === "url"
			? new URL(parsed.request.source.url).host
			: ""
	);

	async function open() {
		if (!parsed?.ok || busy) return;
		busy = true;
		failure = undefined;
		try {
			const made = await materialise(parsed.request);
			const { createProject, setEntry } = await import("$lib/storage/projects");
			const project = await createProject(made.name, made.files);
			if (made.files.some((f) => f.path === made.entry)) await setEntry(project.id, made.entry);
			await goto(resolve(`/workspace/projects/${project.id}` as `/workspace/projects/${string}`));
		} catch (error) {
			log.error("open request failed", error);
			failure = error instanceof Error ? error.message : "Could not open that document.";
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if parsed?.ok}
	<CloudPage
		title="Open in GlyphTeX"
		eyebrow="open"
		description="A link or site asked to open this document. It is copied into this browser; nothing runs until you compile."
	>
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="text-muted-foreground">Name</dt>
			<dd class="text-foreground min-w-0 truncate">{parsed.request.name}</dd>
			<dt class="text-muted-foreground">Main file</dt>
			<dd class="text-foreground min-w-0 truncate">{parsed.request.main}</dd>
			{#if host}
				<dt class="text-muted-foreground">Fetched from</dt>
				<dd class="text-foreground min-w-0 truncate">{host} ({parsed.request.source.kind === "url" ? parsed.request.source.type : ""})</dd>
			{/if}
			{#if parsed.request.engine && parsed.request.engine !== "xelatex"}
				<dt class="text-muted-foreground">Engine</dt>
				<dd class="text-foreground">Asked for {parsed.request.engine}; GlyphTeX compiles with XeTeX.</dd>
			{/if}
		</dl>
		{#if preview}
			<pre class="border-border bg-muted max-h-64 overflow-auto rounded-lg border p-3 font-mono text-xs">{preview}</pre>
		{/if}
		{#if failure}<p class="text-destructive-strong text-sm" role="alert">{failure}</p>{/if}
		<div class="flex flex-wrap gap-2">
			<Button variant="dark" disabled={busy} onclick={open}>
				{#if busy}<IconLoader2 class="animate-spin" />{/if}
				Open in GlyphTeX
			</Button>
			<Button variant="ghost" href={resolve("/")}>Cancel</Button>
		</div>
	</CloudPage>
{:else}
	<CloudPage
		title="Open in GlyphTeX"
		eyebrow="open"
		description={formError ?? (parsed && !parsed.ok ? parsed.error : "Nothing to open. See the guide for the link format.")}
	>
		<Button variant="dark" href={resolve("/developers/open-in-glyphtex")}>Read the guide</Button>
	</CloudPage>
{/if}
