<script lang="ts">
	import {
		Sheet,
		SheetContent,
		SheetDescription,
		SheetHeader,
		SheetTitle
	} from "@glyphtex/ui/sheet";
	import { Tabs, TabsContent, TabsList, TabsTrigger } from "@glyphtex/ui/tabs";

	import { cloudSession } from "$lib/cloud/session.svelte";
	import type { DocumentMeta } from "$lib/documents/store";
	import { Eyebrow } from "$lib/site";
	import CommentsTab from "./CommentsTab.svelte";
	import GitTab from "./GitTab.svelte";
	import SuggestionsTab from "./SuggestionsTab.svelte";
	import VersionsTab from "./VersionsTab.svelte";

	// No trigger of its own: the Collaborate menu opens it.
	let { document, open = $bindable(false) }: { document: DocumentMeta; open?: boolean } = $props();
	let tab = $state("comments");
	const available = $derived(Boolean(document.remoteId) && cloudSession.signedIn);
</script>

{#if available}
	<Sheet bind:open>
		<SheetContent class="flex w-full flex-col gap-4 sm:max-w-md">
			<SheetHeader>
				<Eyebrow label="review" />
				<SheetTitle>Comments, versions and Git</SheetTitle>
				<SheetDescription>
					Work with collaborators without touching each other's text.
				</SheetDescription>
			</SheetHeader>
			<Tabs bind:value={tab} variant="underline" class="flex min-h-0 flex-1 flex-col gap-4">
				<TabsList class="w-full">
					<TabsTrigger value="comments" class="flex-1">Comments</TabsTrigger>
					<TabsTrigger value="suggestions" class="flex-1">Suggestions</TabsTrigger>
					<TabsTrigger value="versions" class="flex-1">Versions</TabsTrigger>
					<TabsTrigger value="git" class="flex-1">Git</TabsTrigger>
				</TabsList>
				<div class="min-h-0 flex-1 overflow-y-auto pr-1">
					<TabsContent value="comments"><CommentsTab {document} /></TabsContent>
					<TabsContent value="suggestions"><SuggestionsTab {document} /></TabsContent>
					<TabsContent value="versions"><VersionsTab {document} /></TabsContent>
					<TabsContent value="git"><GitTab {document} /></TabsContent>
				</div>
			</Tabs>
		</SheetContent>
	</Sheet>
{/if}
