<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<!-- The workspace is per-browser app state, not content. -->
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<!-- The workspace keeps its 12/13/14 type density; app.css reads this through :has(). -->
<div data-density="compact" class="contents">
	{@render children()}
</div>
