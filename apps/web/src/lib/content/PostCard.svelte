<script lang="ts">
	import type { PostMeta } from "$lib/server/content";
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

<a
	href={post.url}
	class={[
		"group flex h-full flex-col rounded-2xl border border-border bg-card p-5 outline-none transition-[border-color] duration-200 ease-craft hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring dark:bg-background",
		featured && "sm:p-8"
	]}
>
	<span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
		<span class="font-medium text-foreground">{post.category}</span>
		{#if dateLabel}<span aria-hidden="true">·</span><time datetime={post.date}>{dateLabel}</time>{/if}
		{#if post.readingMinutes > 0}
			<span aria-hidden="true">·</span><span>{post.readingMinutes} min read</span>
		{/if}
	</span>
	<h3
		class={[
			"mt-3 text-balance font-medium text-foreground",
			featured ? "text-heading-sm" : "text-body-lg"
		]}
	>
		{post.title}
	</h3>
	<p class="mt-2 line-clamp-3 text-pretty text-body text-muted-foreground">{post.description}</p>
	<span
		class="mt-auto flex items-center gap-1 pt-4 text-body font-medium text-muted-foreground transition-colors group-hover:text-foreground"
	>
		Read
		<IconArrowRight
			class="size-4 transition-transform duration-200 ease-craft group-hover:translate-x-0.5"
			aria-hidden="true"
		/>
	</span>
</a>
