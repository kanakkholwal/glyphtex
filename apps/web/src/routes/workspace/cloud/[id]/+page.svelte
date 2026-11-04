<script lang="ts">
	import { page } from "$app/state";
	import ShareButton from "$lib/cloud/ShareButton.svelte";
	import { createCloudStore } from "$lib/documents/cloud";
	import DocumentEditor from "$lib/workspace/DocumentEditor.svelte";

	// One store per visit: it tracks the versions this tab last synced.
	const store = createCloudStore();
	const share = page.url.searchParams.get("share") === "1";
</script>

<DocumentEditor id={page.params.id ?? ''} {store}>
	{#snippet actions(meta)}
		<ShareButton document={meta} kind="cloud" initiallyOpen={share} />
	{/snippet}
</DocumentEditor>
