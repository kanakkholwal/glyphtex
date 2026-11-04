<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { Button } from "@glyphtex/ui/button";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from "@glyphtex/ui/dialog";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconCloudUpload, IconLoader2, IconUserPlus } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import type { DocumentMeta } from "$lib/documents/store";
	import { cloudEnabled, cloudHref } from "./config";
	import { cloudSession } from "./session.svelte";
	import ShareDialog from "./ShareDialog.svelte";
	import { uploadLocalProject } from "./upload";

	interface Props {
		document: DocumentMeta;
		kind: "local" | "cloud";
		/** Open the dialog on mount (arriving from "Save to cloud" with ?share=1). */
		initiallyOpen?: boolean;
	}

	let { document, kind, initiallyOpen = false }: Props = $props();

	let shareOpen = $state(false);
	let uploadOpen = $state(false);
	let uploading = $state(false);

	onMount(() => {
		void cloudSession.ensure();
		if (initiallyOpen && kind === "cloud") shareOpen = true;
	});

	function onclick() {
		if (kind === "cloud") {
			shareOpen = true;
			return;
		}
		if (!cloudSession.signedIn) {
			const next = page.url.pathname;
			void goto(`${resolve("/workspace/account")}?next=${encodeURIComponent(next)}`);
			return;
		}
		uploadOpen = true;
	}

	async function upload() {
		uploading = true;
		try {
			const id = await uploadLocalProject(document.id);
			uploadOpen = false;
			toast.success("Saved to the cloud. This browser keeps its own copy too.");
			void goto(`${cloudHref(id)}?share=1`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not upload this document.");
		} finally {
			uploading = false;
		}
	}
</script>

{#if cloudEnabled}
	<Button variant="ghost" size="sm" {onclick} aria-haspopup="dialog">
		<IconUserPlus /> <span class="hidden lg:inline">Share</span>
	</Button>

	{#if kind === "cloud"}
		<ShareDialog bind:open={shareOpen} {document} />
	{:else}
		<Dialog bind:open={uploadOpen}>
			<DialogContent class="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Save “{document.name}” to the cloud?</DialogTitle>
					<DialogDescription>
						Sharing needs a copy on the server. This document stays in this browser too; from then on
						you share and edit the cloud copy.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="ghost" onclick={() => (uploadOpen = false)}>Cancel</Button>
					<Button variant="dark" disabled={uploading} onclick={upload}>
						{#if uploading}<IconLoader2 class="animate-spin" />{:else}<IconCloudUpload />{/if}
						Save to cloud
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	{/if}
{/if}
