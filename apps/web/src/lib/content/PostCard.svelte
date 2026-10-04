<script lang="ts">
	import type { PostMeta } from "$lib/server/content";

	/** One post as a dashed-rule row; dims with its siblings when the parent list has `group/list`. */
	let { post, featured = false }: { post: PostMeta; featured?: boolean } = $props();

	const dateLabel = $derived(
		post.date
			? new Date(`${post.date}T00:00:00Z`).toLocaleDateString("en-GB", {
					day: "numeric",
					month: "short",
					year: "numeric"
				})
			: ""
	);
</script>

<a
	href={post.url}
	class="flex flex-col gap-1.5 border-t border-dashed border-border py-5 outline-none transition-opacity duration-(--duration-fast) group-hover/list:opacity-50 hover:opacity-100! focus-visible:opacity-100! focus-visible:ring-2 focus-visible:ring-ring"
>
	<span
		class="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground tabular-nums"
	>
		<span>{post.category}</span>
		{#if dateLabel}<span aria-hidden="true">·</span><time datetime={post.date}>{dateLabel}</time>{/if}
		{#if post.readingMinutes > 0}
			<span aria-hidden="true">·</span><span>{post.readingMinutes} min read</span>
		{/if}
	</span>
	<h3
		class={["text-balance font-medium text-foreground", featured ? "text-lg" : "text-base"]}
	>
		{post.title}
	</h3>
	<p
		class={["text-pretty text-sm text-muted-foreground", !featured && "line-clamp-2"]}
	>
		{post.description}
	</p>
</a>
