<script lang="ts">
	import { page } from "$app/state";
	import { localStore } from "$lib/documents/local";
	import DocumentEditor from "$lib/workspace/DocumentEditor.svelte";
	import ShareButton from "$lib/cloud/ShareButton.svelte";
</script>

<DocumentEditor id={page.params.id ?? ''} store={localStore}>
	{#snippet actions(meta)}
		<ShareButton document={meta} kind="local" />
	{/snippet}
</DocumentEditor>
