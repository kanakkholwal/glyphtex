<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { reviewBridge } from "@glyphtex/ui/review";
	import { Skeleton } from "@glyphtex/ui/skeleton";
	import { toast } from "@glyphtex/ui/sonner";
	import { Textarea } from "@glyphtex/ui/textarea";
	import { IconCheck, IconLoader2, IconX } from "@tabler/icons-svelte";

	import { type ReviewSuggestion, cloud } from "$lib/cloud/api";
	import { cloudSession } from "$lib/cloud/session.svelte";
	import type { DocumentMeta } from "$lib/documents/store";
	import { log } from "$lib/log";
	import { locate } from "./anchor";

	let { document }: { document: DocumentMeta } = $props();

	const remoteId = $derived(document.remoteId ?? "");
	const canSuggest = $derived(document.role !== "viewer");
	const canDecide = $derived(document.role === "owner" || document.role === "editor");
	const me = $derived(cloudSession.user?.id);

	let items = $state<ReviewSuggestion[]>([]);
	let loading = $state(true);
	let failed = $state(false);
	let replacement = $state("");
	let busy = $state(false);

	async function load() {
		const path = reviewBridge.path;
		if (!remoteId || !path) {
			items = [];
			loading = false;
			return;
		}
		try {
			items = await cloud.review.suggestions(remoteId, path);
			failed = false;
		} catch (error) {
			log.error("suggestions failed to load", error);
			failed = true;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		reviewBridge.path;
		loading = true;
		void load();
	});

	async function run(task: () => Promise<unknown>, failure: string) {
		busy = true;
		try {
			await task();
			await load();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : failure);
		} finally {
			busy = false;
		}
	}

	/** Reads the selection at click time: the panel can sit open while the selection moves. */
	function propose() {
		const sel = reviewBridge.editor?.selectionRange?.();
		const path = reviewBridge.path;
		if (!sel || !path) return;
		if (sel.to === sel.from) {
			toast.info("Select the text you want to change first.");
			return;
		}
		void run(async () => {
			await cloud.review.suggest(remoteId, {
				path,
				quote: sel.text,
				replacement,
				from: sel.from,
				to: sel.to
			});
			replacement = "";
		}, "Could not send the suggestion.");
	}

	/** Applies the change in the editor first (so saves and live rooms see it), then records the decision. */
	function accept(s: ReviewSuggestion) {
		const editor = reviewBridge.editor;
		const spot = locate(editor?.docText?.() ?? "", {
			from: s.anchorFrom,
			to: s.anchorTo,
			quote: s.quote
		});
		if (!editor || !spot) {
			toast.error(
				"The text this suggestion was about has changed, so it can't be applied. Reject it or ask for a new one."
			);
			return;
		}
		editor.replaceRange(spot.from, spot.to, s.replacement);
		void run(
			() => cloud.review.decide(remoteId, s.id, "accepted"),
			"Applied, but could not record the decision."
		);
	}
</script>

<div class="flex flex-col gap-4">
	{#if !reviewBridge.path}
		<p class="text-muted-foreground text-sm">Open a text file to see its suggestions.</p>
	{:else if loading}
		<div class="flex flex-col gap-2" role="status" aria-busy="true">
			<Skeleton class="h-20 w-full rounded-lg" />
			<span class="sr-only">Loading suggestions</span>
		</div>
	{:else if failed}
		<p class="text-destructive-strong text-sm" role="alert">Could not load suggestions.</p>
		<Button variant="outline" size="sm" class="self-start" onclick={load}>Try again</Button>
	{:else}
		{#if items.length === 0}
			<p class="text-muted-foreground text-sm">No pending suggestions on {reviewBridge.path}.</p>
		{/if}
		{#each items as s (s.id)}
			<article class="border-border bg-background flex flex-col gap-2 rounded-xl border p-3">
				<p class="text-muted-foreground text-xs">{s.authorName} suggests</p>
				<p class="bg-destructive/10 text-foreground rounded-md px-2 py-1 font-mono text-xs whitespace-pre-wrap line-through">{s.quote}</p>
				<p class="bg-primary/10 text-foreground rounded-md px-2 py-1 font-mono text-xs whitespace-pre-wrap">{s.replacement || "(delete)"}</p>
				<div class="flex flex-wrap gap-1">
					{#if canDecide}
						<Button variant="dark" size="sm" disabled={busy} onclick={() => accept(s)}><IconCheck /> Accept</Button>
						<Button variant="outline" size="sm" disabled={busy} onclick={() => run(() => cloud.review.decide(remoteId, s.id, "rejected"), "Could not reject it.")}><IconX /> Reject</Button>
					{/if}
					{#if s.authorId === me}
						<Button variant="ghost" size="sm" disabled={busy} onclick={() => run(() => cloud.review.withdraw(remoteId, s.id), "Could not withdraw it.")}>Withdraw</Button>
					{/if}
				</div>
			</article>
		{/each}

		{#if canSuggest}
			<div class="flex flex-col gap-2">
				<p class="text-muted-foreground text-xs">
					Select the text to change in the editor, then write what it should say.
				</p>
				<Textarea rows={3} placeholder="Replacement text (leave empty to suggest deleting)" bind:value={replacement} />
				<Button variant="dark" size="sm" class="self-start" disabled={busy} onclick={propose}>
					{#if busy}<IconLoader2 class="animate-spin" />{/if} Suggest change
				</Button>
			</div>
		{:else}
			<p class="text-muted-foreground text-xs">Viewers can read suggestions but not make them.</p>
		{/if}
	{/if}
</div>
