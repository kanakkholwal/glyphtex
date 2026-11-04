<script lang="ts">
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
	import { Select, SelectContent, SelectItem, SelectTrigger } from "@glyphtex/ui/select";
	import { toast } from "@glyphtex/ui/sonner";
	import { Switch } from "@glyphtex/ui/switch";
	import { IconLoader2, IconLogout, IconTrash } from "@tabler/icons-svelte";

	import { cloud, type OrgPolicy } from "$lib/cloud/api";
	import { authClient, unwrap } from "$lib/cloud/auth";
	import { cloudSession } from "$lib/cloud/session.svelte";
	import { activeOrg } from "./org-state.svelte";
	import SettingsSection from "./SettingsSection.svelte";

	const view = $derived(activeOrg.view);
	const canManage = $derived(activeOrg.can("org:manage-policy"));
	const isOwner = $derived(activeOrg.can("org:delete"));

	let name = $state("");
	let savingName = $state(false);
	let saving = $state<keyof OrgPolicy | null>(null);
	let confirmOpen = $state(false);
	let confirmText = $state("");
	let deleting = $state(false);

	const ACCESS: { value: OrgPolicy["memberAccess"]; label: string; hint: string }[] = [
		{ value: "editor", label: "Edit", hint: "Members can edit every org project" },
		{ value: "commenter", label: "Comment", hint: "Members can read and comment" },
		{ value: "viewer", label: "View", hint: "Members can only read" },
		{ value: "none", label: "No access", hint: "Only projects shared with them" }
	];

	async function setPolicy<K extends keyof OrgPolicy>(key: K, value: OrgPolicy[K]) {
		if (!view) return;
		saving = key;
		try {
			const policy = await cloud.orgs.updatePolicy(view.organization.id, { [key]: value });
			activeOrg.view = { ...view, policy };
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not save the policy.");
		} finally {
			saving = null;
		}
	}

	async function rename(event: SubmitEvent) {
		event.preventDefault();
		if (!view || !name.trim()) return;
		savingName = true;
		try {
			await unwrap(
				authClient.organization.update({
					organizationId: view.organization.id,
					data: { name: name.trim() }
				})
			);
			await Promise.all([cloudSession.refresh(), activeOrg.load(true)]);
			toast.success("Name saved.");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not rename the organization.");
		} finally {
			savingName = false;
		}
	}

	async function leaveOrDelete() {
		if (!view) return;
		deleting = true;
		try {
			const organizationId = view.organization.id;
			if (isOwner) await unwrap(authClient.organization.delete({ organizationId }));
			else await unwrap(authClient.organization.leave({ organizationId }));
			await cloudSession.switchTo(null);
			await cloudSession.refresh();
			confirmOpen = false;
			toast.success(isOwner ? "Organization deleted." : "You left the organization.");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "That didn't work.");
		} finally {
			deleting = false;
		}
	}

	const toggles: { key: "shareLinks" | "externalInvites" | "ai"; title: string; body: string }[] = [
		{ key: "shareLinks", title: "Share links", body: "Anyone with a link can join a project." },
		{
			key: "externalInvites",
			title: "Invite people outside the organization",
			body: "Project owners can share with any email address."
		},
		{ key: "ai", title: "AI features", body: "Off by default. Admins can allow it per member." }
	];
</script>

{#if view}
	<div class="flex flex-col gap-10">
		<SettingsSection title="Organization" description="Shown to members in the workspace switcher.">
			<form
				class="border-border bg-card flex flex-wrap items-end gap-3 rounded-xl border p-4"
				onsubmit={rename}
			>
				<label class="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium">
					Name
					<Input
						value={view.organization.name}
						oninput={(e) => (name = e.currentTarget.value)}
						disabled={!canManage}
						maxlength={80}
					/>
				</label>
				{#if canManage}
					<Button type="submit" variant="outline" size="sm" disabled={savingName || !name.trim()}>
						{#if savingName}<IconLoader2 class="animate-spin" />{/if} Save
					</Button>
				{/if}
			</form>
		</SettingsSection>

		<SettingsSection
			title="Project access"
			description="What members get on projects that belong to the organization. Admins always manage them."
		>
			<div class="border-border bg-card flex flex-wrap items-center gap-4 rounded-xl border p-4">
				<div class="min-w-0 flex-1">
					<p class="text-foreground text-sm font-medium">Default member access</p>
					<p class="text-muted-foreground text-sm">
						{ACCESS.find((a) => a.value === view.policy.memberAccess)?.hint}
					</p>
				</div>
				<Select
					bind:value={
						() => view.policy.memberAccess,
						(v) => void setPolicy("memberAccess", v as OrgPolicy["memberAccess"])
					}
					disabled={!canManage || saving === "memberAccess"}
				>
					<SelectTrigger size="sm" class="min-w-32" aria-label="Default member access">
						{ACCESS.find((a) => a.value === view.policy.memberAccess)?.label}
					</SelectTrigger>
					<SelectContent>
						{#each ACCESS as a (a.value)}
							<SelectItem value={a.value}>{a.label}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>
		</SettingsSection>

		<SettingsSection title="Policies" description="Members can be given exceptions on the Members tab.">
			<ul class="border-border bg-card divide-border flex flex-col divide-y rounded-xl border">
				{#each toggles as t (t.key)}
					<li class="flex items-center gap-4 p-4">
						<div class="min-w-0 flex-1">
							<p class="text-foreground text-sm font-medium">{t.title}</p>
							<p class="text-muted-foreground text-sm">{t.body}</p>
						</div>
						<Switch
							checked={view.policy[t.key]}
							disabled={!canManage || saving === t.key}
							onCheckedChange={(v) => setPolicy(t.key, v)}
							aria-label={t.title}
						/>
					</li>
				{/each}
				<li class="flex items-center gap-4 p-4">
					<div class="min-w-0 flex-1">
						<p class="text-foreground text-sm font-medium">Seat limit</p>
						<p class="text-muted-foreground text-sm">Empty means no limit.</p>
					</div>
					<Input
						type="number"
						min={1}
						class="w-24"
						value={view.policy.seatLimit === null ? "" : String(view.policy.seatLimit)}
						disabled={!canManage}
						aria-label="Seat limit"
						onchange={(e) => {
							const n = Number.parseInt(e.currentTarget.value, 10);
							void setPolicy("seatLimit", Number.isFinite(n) && n > 0 ? n : null);
						}}
					/>
				</li>
			</ul>
		</SettingsSection>

		<SettingsSection
			title={isOwner ? "Delete organization" : "Leave organization"}
			description={isOwner
				? "Deletes the organization, every project in it and all their files, for everyone."
				: "You lose access to the organization's projects. Your personal projects are untouched."}
		>
			<div class="border-border bg-card flex items-center gap-4 rounded-xl border p-4">
				<p class="text-muted-foreground min-w-0 flex-1 text-sm">This cannot be undone.</p>
				<Button variant="destructive" size="sm" onclick={() => (confirmOpen = true)}>
					{#if isOwner}<IconTrash /> Delete{:else}<IconLogout /> Leave{/if}
				</Button>
			</div>
		</SettingsSection>
	</div>

	<Dialog bind:open={confirmOpen}>
		<DialogContent class="sm:max-w-md">
			<DialogHeader>
				<DialogTitle>{isOwner ? "Delete" : "Leave"} {view.organization.name}?</DialogTitle>
				<DialogDescription>
					{isOwner
						? "Every project in the organization and all their files are deleted for every member."
						: "An owner can invite you back later."}
				</DialogDescription>
			</DialogHeader>
			{#if isOwner}
				<label class="flex flex-col gap-1.5 text-xs font-medium">
					Type the organization name to confirm
					<Input bind:value={confirmText} autocomplete="off" placeholder={view.organization.name} />
				</label>
			{/if}
			<DialogFooter>
				<Button variant="ghost" onclick={() => (confirmOpen = false)}>Cancel</Button>
				<Button
					variant="destructive"
					disabled={deleting || (isOwner && confirmText.trim() !== view.organization.name)}
					onclick={leaveOrDelete}
				>
					{#if deleting}<IconLoader2 class="animate-spin" />{/if}
					{isOwner ? "Delete organization" : "Leave"}
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
{:else if activeOrg.error}
	<p class="text-destructive-strong text-sm">{activeOrg.error}</p>
{:else}
	<p class="text-muted-foreground flex items-center gap-2 text-sm" role="status">
		<IconLoader2 size={14} class="animate-spin" /> Loading…
	</p>
{/if}
