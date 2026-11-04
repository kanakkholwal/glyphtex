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
	import { Tooltip, TooltipContent, TooltipTrigger } from "@glyphtex/ui/tooltip";
	import {
		IconAlertTriangle,
		IconCloudCheck,
		IconCloudUpload,
		IconLoader2,
		IconRefresh,
		IconUserPlus
	} from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import type { DocumentMeta } from "$lib/documents/store";
	import { notifyTreeChanged } from "$lib/git";
	import { linkProject } from "$lib/sync/engine";
	import { sync } from "$lib/sync/sync.svelte";
	import { cloudEnabled } from "./config";
	import { cloudSession } from "./session.svelte";
	import ShareDialog from "./ShareDialog.svelte";

	interface Props {
		document: DocumentMeta;
		/** Open the share dialog on mount (arriving from a "share" link). */
		initiallyOpen?: boolean;
	}

	let { document, initiallyOpen = false }: Props = $props();

	let shareOpen = $state(false);
	let linkOpen = $state(false);
	let linking = $state(false);
	/** Whether to open sharing once the copy is linked; "Save to cloud" alone doesn't. */
	let thenShare = $state(false);

	const linked = $derived(Boolean(document.remoteId));
	const syncState = $derived(sync.state.get(document.id));
	const conflicts = $derived(document.conflicts?.length ?? 0);

	onMount(() => {
		void cloudSession.ensure();
		if (initiallyOpen && linked) shareOpen = true;
	});

	function requireSignIn() {
		if (cloudSession.signedIn) return true;
		void goto(`${resolve("/workspace/account")}?next=${encodeURIComponent(page.url.pathname)}`);
		return false;
	}

	function share() {
		if (!requireSignIn()) return;
		if (linked) shareOpen = true;
		else {
			thenShare = true;
			linkOpen = true;
		}
	}

	async function link() {
		linking = true;
		try {
			await linkProject(document.id, cloudSession.activeOrgId);
			linkOpen = false;
			toast.success("Saved to the cloud. Edits now sync from this browser.");
			// Reload the editor so it picks up the link (role, server id).
			notifyTreeChanged(document.id);
			if (thenShare) shareOpen = true;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not save this to the cloud.");
		} finally {
			linking = false;
		}
	}

	async function syncNow() {
		try {
			const r = await sync.run(document.id);
			if (r.conflicts.length) {
				toast.warning(
					`${r.conflicts.length} ${r.conflicts.length === 1 ? "file was" : "files were"} edited in two places. The server version sits beside yours as "(server copy)".`
				);
			} else toast.success(r.pushed || r.pulled ? "Synced." : "Already up to date.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Sync failed.");
		}
	}

	const label = $derived(
		syncState === "syncing"
			? "Syncing…"
			: syncState === "error"
				? (sync.errors.get(document.id) ?? "Sync failed")
				: conflicts || syncState === "conflict"
					? "Some files need a decision"
					: sync.automatic
						? "Synced automatically"
						: "Sync now"
	);
</script>

{#if cloudEnabled}
	{#if linked}
		<Tooltip delayDuration={300}>
			<TooltipTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon-sm"
						aria-label={label}
						disabled={syncState === "syncing"}
						onclick={syncNow}
					>
						{#if syncState === "syncing"}<IconLoader2 class="animate-spin" />
						{:else if syncState === "error" || conflicts}<IconAlertTriangle class="text-warning-strong" />
						{:else if sync.automatic}<IconCloudCheck />
						{:else}<IconRefresh />{/if}
					</Button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	{:else if cloudSession.signedIn}
		<Button
			variant="ghost"
			size="sm"
			onclick={() => {
				thenShare = false;
				linkOpen = true;
			}}
		>
			<IconCloudUpload /> <span class="hidden lg:inline">Save to cloud</span>
		</Button>
	{/if}
	<Button variant="ghost" size="sm" onclick={share} aria-haspopup="dialog">
		<IconUserPlus /> <span class="hidden lg:inline">Share</span>
	</Button>

	{#if linked}
		<ShareDialog bind:open={shareOpen} {document} />
	{/if}

	<Dialog bind:open={linkOpen}>
		<DialogContent class="sm:max-w-md">
			<DialogHeader>
				<DialogTitle>Save “{document.name}” to the cloud?</DialogTitle>
				<DialogDescription>
					{cloudSession.activeOrg
						? `A copy goes to ${cloudSession.activeOrg.name}. `
						: "A copy goes to your account. "}
					It stays in this browser too and keeps working offline;
					{sync.automatic ? " edits sync automatically." : " you choose when to sync."}
				</DialogDescription>
			</DialogHeader>
			<DialogFooter>
				<Button variant="ghost" onclick={() => (linkOpen = false)}>Cancel</Button>
				<Button variant="dark" disabled={linking} onclick={link}>
					{#if linking}<IconLoader2 class="animate-spin" />{:else}<IconCloudUpload />{/if}
					Save to cloud
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
{/if}
