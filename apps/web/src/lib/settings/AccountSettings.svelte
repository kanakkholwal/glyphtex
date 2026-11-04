<script lang="ts">
	import { resolve } from "$app/paths";
	import { Avatar, AvatarFallback, AvatarImage } from "@glyphtex/ui/avatar";
	import { Button } from "@glyphtex/ui/button";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from "@glyphtex/ui/dialog";
	import {
		Empty,
		EmptyContent,
		EmptyDescription,
		EmptyHeader,
		EmptyMedia,
		EmptyTitle
	} from "@glyphtex/ui/empty";
	import { Input } from "@glyphtex/ui/input";
	import { toast } from "@glyphtex/ui/sonner";
	import {
		IconCloudOff,
		IconDownload,
		IconLoader2,
		IconLogin,
		IconLogout,
		IconTrash
	} from "@tabler/icons-svelte";

	import { cloud } from "$lib/cloud/api";
	import { appUrl, authClient, unwrap } from "$lib/cloud/auth";
	import { cloudEnabled } from "$lib/cloud/config";
	import { cloudSession } from "$lib/cloud/session.svelte";
	import SettingsSection from "./SettingsSection.svelte";

	let exporting = $state(false);
	let deleteOpen = $state(false);
	let confirmEmail = $state("");
	let deleting = $state(false);
	let deleteSent = $state(false);

	const initials = (name: string) =>
		name
			.split(/[\s@.]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase())
			.join("") || "?";

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
	<Empty class="border-border rounded-xl border">
		<EmptyHeader>
			<EmptyMedia variant="icon"><IconCloudOff /></EmptyMedia>
			<EmptyTitle>No server connected</EmptyTitle>
			<EmptyDescription>
				This GlyphTeX keeps everything in your browser, so there is no account to manage.
			</EmptyDescription>
		</EmptyHeader>
	</Empty>
{:else if !cloudSession.user}
	<Empty class="border-border rounded-xl border">
		<EmptyHeader>
			<EmptyMedia variant="icon"><IconLogin /></EmptyMedia>
			<EmptyTitle>You're not signed in</EmptyTitle>
			<EmptyDescription>
				Sign in to save projects to the server and share them. Documents in this browser keep working
				without an account.
			</EmptyDescription>
		</EmptyHeader>
		<EmptyContent>
			<Button
				variant="dark"
				size="sm"
				href={`${resolve('/workspace/account')}?next=${encodeURIComponent('/workspace/settings?tab=account')}`}
			>
				Sign in
			</Button>
		</EmptyContent>
	</Empty>
{:else}
	{@const user = cloudSession.user}
	<div class="flex flex-col gap-10">
		<SettingsSection title="Profile" description="How collaborators see you on shared projects.">
			<div class="border-border bg-background flex flex-wrap items-center gap-4 rounded-xl border p-4">
				<Avatar size="lg">
					{#if user.image}<AvatarImage src={user.image} alt="" />{/if}
					<AvatarFallback>{initials(user.name || user.email)}</AvatarFallback>
				</Avatar>
				<div class="min-w-0 flex-1">
					<p class="text-foreground truncate text-sm font-medium">{user.name || user.email}</p>
					<p class="text-muted-foreground truncate text-sm">{user.email}</p>
				</div>
				<Button variant="outline" size="sm" onclick={() => cloudSession.signOut()}>
					<IconLogout /> Sign out
				</Button>
			</div>
		</SettingsSection>

		<SettingsSection title="Your data" description="Take everything with you at any time.">
			{#snippet action()}
				<Button variant="outline" size="sm" disabled={exporting} onclick={exportAll}>
					{#if exporting}<IconLoader2 class="animate-spin" />{:else}<IconDownload />{/if}
					Export all
				</Button>
			{/snippet}
			<p class="border-border bg-background text-muted-foreground rounded-xl border p-4 text-sm">
				One zip with a folder for every cloud project you own, text and images included.
			</p>
		</SettingsSection>

		<SettingsSection title="Delete account" description="There is no recycle bin and no grace period.">
			<div
				class="border-border bg-background flex flex-wrap items-center gap-4 rounded-xl border p-4"
			>
				<p class="text-muted-foreground min-w-0 flex-1 text-sm">
					Permanently deletes your account, every project you own and all their files. Projects
					others shared with you stay with their owners.
				</p>
				<Button variant="destructive" size="sm" onclick={() => (deleteOpen = true)}>
					<IconTrash /> Delete account
				</Button>
			</div>
		</SettingsSection>
	</div>

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
{/if}
