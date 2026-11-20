<script lang="ts">
	import { page } from "$app/state";
	import { localStore } from "$lib/documents/local";
	import DocumentEditor from "$lib/workspace/DocumentEditor.svelte";
	import CollaborateMenu from "$lib/cloud/CollaborateMenu.svelte";
	import ShareButton from "$lib/cloud/ShareButton.svelte";
</script>

<DocumentEditor id={page.params.id ?? ''} store={localStore}>
	{#snippet actions(meta)}
		<CollaborateMenu document={meta} />
		<ShareButton document={meta} initiallyOpen={page.url.searchParams.get("share") === "1"} />
	{/snippet}
</DocumentEditor>
