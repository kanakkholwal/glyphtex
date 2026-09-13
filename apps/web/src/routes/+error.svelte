<script lang="ts">
	import { page } from "$app/state";
	import { ErrorState, RailFrame, RailRow } from "$lib/site";

	const status = $derived(page.status);
</script>

<svelte:head>
	<title>{status} · GlyphTeX</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<RailFrame>
	<RailRow divider={false} label="Error" class="min-h-[70svh] justify-center px-4 pt-32 pb-16 sm:px-10 lg:px-16">
		<ErrorState {status} message={page.error?.message} />
	</RailRow>
</RailFrame>
