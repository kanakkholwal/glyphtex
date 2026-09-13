<script lang="ts">
	let { title, description }: { title: string; description: string } = $props();
</script>

<svelte:head><title>{title} · Settings · GlyphTeX</title></svelte:head>

<header class="flex flex-col gap-1">
	<h1 class="text-heading-sm font-medium text-foreground">{title}</h1>
	<p class="text-body text-muted-foreground">{description}</p>
</header>
