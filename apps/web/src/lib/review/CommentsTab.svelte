<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { reviewBridge } from "@glyphtex/ui/review";
	import { Skeleton } from "@glyphtex/ui/skeleton";
	import { toast } from "@glyphtex/ui/sonner";
	import { Textarea } from "@glyphtex/ui/textarea";
	import { IconCheck, IconLoader2, IconRestore, IconTrash } from "@tabler/icons-svelte";

	import { type ReviewComment, cloud } from "$lib/cloud/api";
	import { cloudSession } from "$lib/cloud/session.svelte";
	import type { DocumentMeta } from "$lib/documents/store";
	import { log } from "$lib/log";
	import { locate } from "./anchor";

	let { document }: { document: DocumentMeta } = $props();

	const remoteId = $derived(document.remoteId ?? "");
	const canComment = $derived(document.role !== "viewer");
	const canWrite = $derived(document.role === "owner" || document.role === "editor");
	const me = $derived(cloudSession.user?.id);

	let comments = $state<ReviewComment[]>([]);
	let loading = $state(true);
	let failed = $state(false);
	let draft = $state("");
	let busy = $state(false);
	let replyFor = $state<string | null>(null);
	let reply = $state("");

	const roots = $derived(comments.filter((c) => !c.parentId));
	const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

	async function load() {
		const path = reviewBridge.path;
		if (!remoteId || !path) {
			comments = [];
			loading = false;
			return;
		}
		try {
			comments = await cloud.review.comments(remoteId, path);
			failed = false;
		} catch (error) {
			log.error("comments failed to load", error);
			failed = true;
		} finally {
			loading = false;
		}
	}

	// Reload when the open file changes.
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

	function add() {
		const body = draft.trim();
		const path = reviewBridge.path;
		if (!body || !path) return;
		const sel = reviewBridge.editor?.selectionRange?.();
		const anchored = sel && sel.to > sel.from;
		void run(async () => {
			await cloud.review.addComment(remoteId, {
				path,
				body,
				...(anchored && { quote: sel.text.slice(0, 2000), from: sel.from, to: sel.to })
			});
			draft = "";
		}, "Could not post the comment.");
	}

	function sendReply(parentId: string) {
		const body = reply.trim();
		const path = reviewBridge.path;
		if (!body || !path) return;
		void run(async () => {
			await cloud.review.addComment(remoteId, { path, body, parentId });
			reply = "";
			replyFor = null;
		}, "Could not post the reply.");
	}

	/** Moves the editor to where the thread's text sits now, or tells the reader it was changed. */
	function jump(c: ReviewComment) {
		const text = reviewBridge.editor?.docText?.() ?? "";
		const spot =
			c.anchorFrom !== null && c.anchorTo !== null
				? locate(text, { from: c.anchorFrom, to: c.anchorTo, quote: c.quote })
				: null;
		if (spot) reviewBridge.editor?.selectRange(spot.from, spot.to);
		else toast.info("The text this comment was about has changed or been removed.");
	}

	const when = (iso: string) =>
		new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
</script>

<div class="flex flex-col gap-4">
	{#if !reviewBridge.path}
		<p class="text-muted-foreground text-sm">Open a text file to see its comments.</p>
	{:else if loading}
		<div class="flex flex-col gap-2" role="status" aria-busy="true">
			<Skeleton class="h-16 w-full rounded-lg" />
			<Skeleton class="h-16 w-full rounded-lg" />
			<span class="sr-only">Loading comments</span>
		</div>
	{:else if failed}
		<p class="text-destructive-strong text-sm" role="alert">Could not load comments.</p>
		<Button variant="outline" size="sm" class="self-start" onclick={load}>Try again</Button>
	{:else}
		{#if roots.length === 0}
			<p class="text-muted-foreground text-sm">
				No comments on {reviewBridge.path} yet. Select text in the editor to attach one to it.
			</p>
		{/if}
		{#each roots as c (c.id)}
			<article
				class="border-border bg-background flex flex-col gap-2 rounded-xl border p-3 {c.resolvedAt ? 'opacity-60' : ''}"
			>
				{#if c.quote}
					<button
						type="button"
						class="border-border text-muted-foreground hover:text-foreground line-clamp-2 border-l-2 pl-2 text-left font-mono text-xs"
						onclick={() => jump(c)}
					>
						{c.quote}
					</button>
				{/if}
				<p class="text-foreground text-sm text-pretty whitespace-pre-wrap">{c.body}</p>
				<p class="text-muted-foreground text-xs">{c.authorName} · {when(c.createdAt)}{c.resolvedAt ? " · resolved" : ""}</p>

				{#each repliesOf(c.id) as r (r.id)}
					<div class="border-border border-t border-dashed pt-2">
						<p class="text-foreground text-sm text-pretty whitespace-pre-wrap">{r.body}</p>
						<p class="text-muted-foreground text-xs">{r.authorName} · {when(r.createdAt)}</p>
					</div>
				{/each}

				<div class="flex flex-wrap items-center gap-1">
					{#if canComment && !c.resolvedAt}
						<Button variant="ghost" size="sm" onclick={() => (replyFor = replyFor === c.id ? null : c.id)}>Reply</Button>
					{/if}
					{#if canComment && (c.authorId === me || canWrite)}
						<Button variant="ghost" size="sm" disabled={busy} onclick={() => run(() => cloud.review.resolve(remoteId, c.id, !c.resolvedAt), "Could not update the thread.")}>
							{#if c.resolvedAt}<IconRestore /> Reopen{:else}<IconCheck /> Resolve{/if}
						</Button>
					{/if}
					{#if c.authorId === me || document.role === "owner"}
						<Button variant="ghost" size="sm" disabled={busy} aria-label="Delete thread" onclick={() => run(() => cloud.review.removeComment(remoteId, c.id), "Could not delete the thread.")}>
							<IconTrash />
						</Button>
					{/if}
				</div>
				{#if replyFor === c.id}
					<Textarea rows={2} placeholder="Write a reply" bind:value={reply} />
					<Button size="sm" variant="dark" class="self-start" disabled={busy || !reply.trim()} onclick={() => sendReply(c.id)}>Reply</Button>
				{/if}
			</article>
		{/each}

		{#if canComment}
			<div class="flex flex-col gap-2">
				<Textarea rows={3} placeholder="Comment on the selected text, or on the whole file" bind:value={draft} />
				<Button variant="dark" size="sm" class="self-start" disabled={busy || !draft.trim()} onclick={add}>
					{#if busy}<IconLoader2 class="animate-spin" />{/if} Comment
				</Button>
			</div>
		{:else}
			<p class="text-muted-foreground text-xs">Viewers can read comments but not add them.</p>
		{/if}
	{/if}
</div>
