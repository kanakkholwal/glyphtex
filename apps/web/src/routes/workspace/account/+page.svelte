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
	import { Input } from "@glyphtex/ui/input";
	import { toast } from "@glyphtex/ui/sonner";
	import {
		IconArrowLeft,
		IconDownload,
		IconLoader2,
		IconLogout,
		IconTrash
	} from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { cloud } from "$lib/cloud/api";
	import { appUrl, authClient, unwrap } from "$lib/cloud/auth";
	import CloudPage from "$lib/cloud/CloudPage.svelte";
	import { cloudEnabled } from "$lib/cloud/config";
	import { safeNext } from "$lib/cloud/next";
	import { cloudSession } from "$lib/cloud/session.svelte";
	import SignInPanel from "$lib/cloud/SignInPanel.svelte";

	const next = $derived(safeNext(page.url.searchParams.get("next")));
	const deleted = $derived(page.url.searchParams.get("deleted") === "1");

	let exporting = $state(false);
	let deleteOpen = $state(false);
	let confirmEmail = $state("");
	let deleting = $state(false);
	let deleteSent = $state(false);

	onMount(() => void cloudSession.refresh());

	function afterSignIn() {
		void goto(next);
	}

	async function exportAll() {
		exporting = true;
		try {
			const zip = await cloud.account.exportZip();
			const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
			const a = document.createElement("a");
			a.href = url;
			a.download = `glyphtex-export-${new Date().toISOString().slice(0, 10)}.zip`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not export your projects.");
		} finally {
			exporting = false;
		}
	}

	async function signOut() {
		await cloudSession.signOut();
		toast.success("Signed out.");
	}

	async function requestDeletion() {
		deleting = true;
		try {
			await unwrap(authClient.deleteUser({ callbackURL: appUrl("/workspace/account?deleted=1") }));
			deleteSent = true;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not start account deletion.");
		} finally {
			deleting = false;
		}
	}
</script>

{#if !cloudEnabled}
	<CloudPage
		title="Accounts aren't set up here"
		description="This GlyphTeX has no server configured, so documents stay in your browser. Nothing to sign in to."
	>
		<Button variant="dark" class="self-start" href={resolve('/workspace')}>Back to projects</Button>
	</CloudPage>
{:else if deleted}
	<CloudPage
		title="Your account is deleted"
		description="Your account, every project you owned and all their files were permanently removed. Documents saved only in this browser are untouched."
	>
		<Button variant="dark" class="self-start" href={resolve('/workspace')}>Back to projects</Button>
	</CloudPage>
{:else if cloudSession.status === 'idle' || (cloudSession.status === 'loading' && !cloudSession.user)}
	<CloudPage title="Account">
		<p class="text-muted-foreground flex items-center gap-2 text-sm" role="status">
			<IconLoader2 size={14} class="animate-spin" /> Checking your session…
		</p>
	</CloudPage>
{:else if !cloudSession.user}
	<CloudPage
		title="Sign in to GlyphTeX"
		description="An account lets you save documents to the server and share them. Documents in this browser keep working without one."
	>
		<SignInPanel {next} onsignedin={afterSignIn} />
	</CloudPage>
{:else}
	{@const user = cloudSession.user}
	<CloudPage title="Account" description={`Signed in as ${user.email}`}>
		{#snippet footer()}
			<Button variant="ghost" size="sm" href={resolve('/workspace')}>
				<IconArrowLeft /> Back to projects
			</Button>
		{/snippet}
		<ul class="divide-border flex flex-col divide-y">
			<li class="flex items-center gap-4 pb-4">
				<span class="bg-muted grid size-10 shrink-0 place-items-center rounded-full text-sm font-medium" aria-hidden="true">
					{(user.name || user.email).slice(0, 1).toUpperCase()}
				</span>
				<div class="min-w-0 flex-1">
					<p class="text-foreground truncate text-sm font-medium">{user.name || user.email}</p>
					<p class="text-muted-foreground truncate text-sm">{user.email}</p>
				</div>
				<Button variant="outline" size="sm" onclick={signOut}><IconLogout /> Sign out</Button>
			</li>
			<li class="flex items-center gap-4 py-4">
				<span class="bg-muted text-foreground grid size-10 shrink-0 place-items-center rounded-lg" aria-hidden="true">
					<IconDownload size={20} />
				</span>
				<div class="min-w-0 flex-1">
					<p class="text-foreground text-sm font-medium">Export your projects</p>
					<p class="text-muted-foreground text-sm">One zip with a folder per cloud project you own.</p>
				</div>
				<Button variant="outline" size="sm" disabled={exporting} onclick={exportAll}>
					{#if exporting}<IconLoader2 class="animate-spin" />{/if} Export
				</Button>
			</li>
			<li class="flex items-center gap-4 pt-4">
				<span class="bg-muted text-destructive-strong grid size-10 shrink-0 place-items-center rounded-lg" aria-hidden="true">
					<IconTrash size={20} />
				</span>
				<div class="min-w-0 flex-1">
					<p class="text-foreground text-sm font-medium">Delete account</p>
					<p class="text-muted-foreground text-sm">
						Removes your account, every project you own and all their files. No recycle bin, no grace period.
					</p>
				</div>
				<Button variant="destructive" size="sm" onclick={() => (deleteOpen = true)}>Delete</Button>
			</li>
		</ul>

		<Dialog bind:open={deleteOpen}>
			<DialogContent class="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Delete your account?</DialogTitle>
					<DialogDescription>
						{deleteSent
							? `We emailed a confirmation link to ${user.email}. Your account is deleted when you open it.`
							: 'This cannot be undone. Export your projects first if you want to keep them. We will email you a link to confirm.'}
					</DialogDescription>
				</DialogHeader>
				{#if !deleteSent}
					<label class="flex flex-col gap-1 text-xs font-medium">
						Type your email to confirm
						<Input bind:value={confirmEmail} autocomplete="off" placeholder={user.email} />
					</label>
				{/if}
				<DialogFooter>
					<Button variant="ghost" onclick={() => (deleteOpen = false)}>
						{deleteSent ? 'Close' : 'Cancel'}
					</Button>
					{#if !deleteSent}
						<Button
							variant="destructive"
							disabled={deleting || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()}
							onclick={requestDeletion}
						>
							{#if deleting}<IconLoader2 class="animate-spin" />{/if}
							Email me the confirmation
						</Button>
					{/if}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	</CloudPage>
{/if}
