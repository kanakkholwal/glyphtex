<script lang="ts">
	import type { PostMeta } from "$lib/server/content";
	import { IconArrowUpRight } from "@tabler/icons-svelte";

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
	class={[
		"group flex flex-col rounded-2xl border border-hairline bg-surface-card p-6 transition-colors hover:border-foreground/25",
		featured && "sm:p-8"
	]}
>
	<div class="flex items-center gap-2 text-xs text-muted-foreground">
		<span class="font-medium text-foreground">{post.category}</span>
		{#if dateLabel}<span aria-hidden="true">·</span><time datetime={post.date}>{dateLabel}</time>{/if}
		<span aria-hidden="true">·</span><span>{post.readingMinutes} min read</span>
	</div>
	<h3
		class={[
			"mt-3 font-semibold tracking-tight text-foreground",
			featured ? "text-2xl" : "text-lg"
		]}
	>
		{post.title}
	</h3>
	<p class="mt-2 line-clamp-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
		{post.description}
	</p>
	<span
		class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground/70 transition-colors group-hover:text-foreground"
	>
		Read
		<IconArrowUpRight class="size-4" stroke-width={2} />
	</span>
</a>
