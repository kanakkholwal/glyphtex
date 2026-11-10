<script lang="ts">
	import { browser } from "$app/environment";
	import { cloudSession } from "$lib/cloud/session.svelte";

	let { data, children } = $props();

	// Browser only: the store is a module singleton, so the server must never write request state into it.
	$effect.pre(() => {
		if (browser) cloudSession.hydrate(data.auth);
	});
</script>

<svelte:head>
	<!-- The workspace is per-browser app state, not content. -->
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<!-- The workspace keeps its 12/13/14 type density; app.css reads this through :has(). -->
<div data-density="compact" class="contents">
	{@render children()}
</div>
