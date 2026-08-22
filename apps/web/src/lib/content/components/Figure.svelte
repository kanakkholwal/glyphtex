<script lang="ts">
	type Props = { src?: string; alt?: string; caption?: string; ratio?: string; plain?: boolean };

	let { src = "", alt = "", caption = "", ratio = "16 / 9", plain = false }: Props = $props();
</script>

<figure class="not-prose my-9">
	<div
		class={[
			"overflow-hidden rounded-2xl",
			!plain && "border border-hairline bg-surface-soft"
		]}
		style="aspect-ratio: {ratio}"
	>
		<img {src} {alt} loading="lazy" decoding="async" class="size-full object-cover" />
	</div>
	{#if caption}
		<figcaption class="mt-3 text-sm leading-relaxed text-muted-foreground">{caption}</figcaption>
	{/if}
</figure>
