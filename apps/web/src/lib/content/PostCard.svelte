<script lang="ts">
	import type { PostMeta } from "$lib/server/content";
	import { Badge } from "@glyphtex/ui/badge";
	import { Card } from "@glyphtex/ui/card";
	import { IconArrowRight } from "@tabler/icons-svelte";

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

<a href={post.url} class="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl">
	<Card
		tone="framed"
		size="sm"
		class={[
			"h-full transition-[border-color] duration-200 ease-craft group-hover:border-border-strong",
			featured && "sm:p-8"
		]}
	>
		<span class="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
			<Badge variant="secondary">{post.category}</Badge>
			{#if dateLabel}<span aria-hidden="true">·</span><time datetime={post.date}>{dateLabel}</time>{/if}
			{#if post.readingMinutes > 0}
				<span aria-hidden="true">·</span><span>{post.readingMinutes} min read</span>
			{/if}
		</span>
		<h3
			class={[
				"text-balance font-medium text-foreground",
				featured ? "text-heading-sm" : "text-body-lg"
			]}
		>
			{post.title}
		</h3>
		<p class="line-clamp-3 text-pretty text-body text-muted-foreground">{post.description}</p>
		<span
			class="mt-auto flex items-center gap-1 text-body font-medium text-muted-foreground transition-colors group-hover:text-foreground"
		>
			Read
			<IconArrowRight
				class="size-4 transition-transform duration-200 ease-craft group-hover:translate-x-0.5"
				aria-hidden="true"
			/>
		</span>
	</Card>
</a>
