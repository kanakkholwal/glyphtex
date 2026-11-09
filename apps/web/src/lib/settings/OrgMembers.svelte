<script lang="ts">
	import RowsSkeleton from "$lib/loading/RowsSkeleton.svelte";
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
		DropdownMenu,
		DropdownMenuCheckboxItem,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuLabel,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from "@glyphtex/ui/dropdown-menu";
	import { Input } from "@glyphtex/ui/input";
	import { Select, SelectContent, SelectItem, SelectTrigger } from "@glyphtex/ui/select";
	import { toast } from "@glyphtex/ui/sonner";
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from "@glyphtex/ui/table";
	import { IconDots, IconLoader2, IconTrash, IconUserPlus } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { cloud, type Feature, type MemberFeatures } from "$lib/cloud/api";
	import { authClient, unwrap } from "$lib/cloud/auth";
	import { cloudSession } from "$lib/cloud/session.svelte";
	import { activeOrg } from "./org-state.svelte";
	import SettingsSection from "./SettingsSection.svelte";

	type Role = "owner" | "admin" | "member";
	type Row = {
		id: string;
		userId: string;
		role: string;
		user: { name: string; email: string; image?: string | null };
	};
	type Pending = { id: string; email: string; role: string | null; status: string };

	const orgId = $derived(activeOrg.view?.organization.id ?? null);
	const canManage = $derived(activeOrg.can("org:manage-members"));
	const isOwner = $derived(activeOrg.can("org:delete"));

	let members = $state<Row[]>([]);
	let pending = $state<Pending[]>([]);
	let limit = $derived(activeOrg.view?.policy.seatLimit ?? null);
	let loading = $state(true);
	let busy = $state(false);

	let inviteOpen = $state(false);
	let inviteEmail = $state("");
	let inviteRole = $state<Role>("member");

	/** Per-member feature state, loaded when their menu opens. */
	let features = $state<Record<string, MemberFeatures>>({});

	const ROLES: { value: Role; label: string }[] = [
		{ value: "owner", label: "Owner" },
		{ value: "admin", label: "Admin" },
		{ value: "member", label: "Member" }
	];
	const FEATURE_LABELS: Record<Feature, string> = {
		shareLinks: "Share links",
		externalInvites: "Invite outside the org",
		ai: "AI features"
	};

	const initials = (name: string) =>
		name
			.split(/[\s@.]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase())
			.join("") || "?";
	const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r;

	async function load() {
		if (!orgId) return;
		try {
			const full = await unwrap(
				authClient.organization.getFullOrganization({ query: { organizationId: orgId } })
			);
			members = (full?.members ?? []) as Row[];
			pending = ((full?.invitations ?? []) as Pending[]).filter((i) => i.status === "pending");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not load members.");
		} finally {
			loading = false;
		}
	}

	onMount(() => void load());

	async function act(run: () => Promise<unknown>, fallback: string, success?: string) {
		busy = true;
		try {
			await run();
			if (success) toast.success(success);
			await load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : fallback);
		} finally {
			busy = false;
		}
	}

	function invite(event: SubmitEvent) {
		event.preventDefault();
		const email = inviteEmail.trim();
		if (!orgId || !email) return;
		void act(
			() =>
				unwrap(
					authClient.organization.inviteMember({ email, role: inviteRole, organizationId: orgId })
				),
			"Could not send the invite.",
			`Invite sent to ${email}.`
		).then(() => {
			inviteEmail = "";
			inviteOpen = false;
		});
	}

	async function loadFeatures(userId: string) {
		if (!orgId || features[userId]) return;
		try {
			features[userId] = await cloud.orgs.memberFeatures(orgId, userId);
		} catch {
			// The menu still works without the feature section; nothing to tell the user.
		}
	}

	async function setFeature(userId: string, feature: Feature, enabled: boolean) {
		if (!orgId) return;
		const current = features[userId];
		// Matching the org default drops the override, so later policy changes apply again.
		const next = current && current.policy[feature] === enabled ? null : enabled;
		try {
			features[userId] = await cloud.orgs.setMemberFeature(orgId, userId, feature, next);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not change that.");
		}
	}
</script>

<SettingsSection
	title="Members"
	description={limit ? `${members.length} of ${limit} seats used` : `${members.length} ${members.length === 1 ? "member" : "members"}`}
>
	{#snippet action()}
		{#if canManage}
			<Button variant="dark" size="sm" onclick={() => (inviteOpen = true)}>
				<IconUserPlus /> Invite
			</Button>
		{/if}
	{/snippet}

	{#if loading}
		<RowsSkeleton rows={4} avatar label="Loading members" />
	{:else}
		<Table variant="framed" class="table-fixed">
			<TableHeader>
				<TableRow>
					<TableHead>Member</TableHead>
					<TableHead class="w-48 text-right">Role</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#each members as m (m.id)}
					{@const me = m.userId === cloudSession.user?.id}
					<TableRow>
						<TableCell class="max-w-0">
							<div class="flex min-w-0 items-center gap-3">
								<Avatar size="sm">
									{#if m.user.image}<AvatarImage src={m.user.image} alt="" />{/if}
									<AvatarFallback>{initials(m.user.name || m.user.email)}</AvatarFallback>
								</Avatar>
								<div class="min-w-0">
									<p class="text-foreground truncate text-sm font-medium">
										{m.user.name || m.user.email}{#if me}<span class="text-muted-foreground font-normal"> (you)</span>{/if}
									</p>
									<p class="text-muted-foreground truncate text-xs">{m.user.email}</p>
								</div>
							</div>
						</TableCell>
						<TableCell class="text-right">
							{#if canManage && !me && (isOwner || m.role !== "owner")}
								<div class="flex items-center justify-end gap-1">
									<Select
										bind:value={
											() => m.role,
											(v) =>
												void act(
													() =>
														unwrap(
															authClient.organization.updateMemberRole({
																memberId: m.id,
																role: v as Role,
																organizationId: orgId ?? undefined
															})
														),
													"Could not change the role."
												)
										}
										disabled={busy}
									>
										<SelectTrigger size="sm" class="w-auto min-w-28 shrink-0" aria-label={`Role for ${m.user.email}`}>
											{roleLabel(m.role)}
										</SelectTrigger>
										<SelectContent>
											{#each ROLES.filter((r) => isOwner || r.value !== "owner") as r (r.value)}
												<SelectItem value={r.value}>{r.label}</SelectItem>
											{/each}
										</SelectContent>
									</Select>
									<DropdownMenu onOpenChange={(open) => open && void loadFeatures(m.userId)}>
										<DropdownMenuTrigger>
											{#snippet child({ props })}
												<Button {...props} variant="outline" size="icon-sm" aria-label={`More for ${m.user.email}`}>
													<IconDots />
												</Button>
											{/snippet}
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuLabel>Features</DropdownMenuLabel>
											{#each Object.keys(FEATURE_LABELS) as Feature[] as f (f)}
												<DropdownMenuCheckboxItem
													checked={features[m.userId]?.features[f] ?? false}
													disabled={!features[m.userId]}
													onCheckedChange={(v) => void setFeature(m.userId, f, v)}
												>
													{FEATURE_LABELS[f]}
												</DropdownMenuCheckboxItem>
											{/each}
											<DropdownMenuSeparator />
											<DropdownMenuItem
												destructive
												onclick={() =>
													act(
														() =>
															unwrap(
																authClient.organization.removeMember({
																	memberIdOrEmail: m.id,
																	organizationId: orgId ?? undefined
																})
															),
														"Could not remove them.",
														"Removed. Their org projects moved to an owner."
													)}
											>
												<IconTrash /> Remove from organization
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							{:else}
								<span class="text-muted-foreground text-sm">{roleLabel(m.role)}</span>
							{/if}
						</TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	{/if}
</SettingsSection>

{#if canManage && pending.length > 0}
	<div class="mt-10">
		<SettingsSection title="Pending invitations" description="They expire after a week.">
			<Table variant="framed" class="table-fixed">
				<TableHeader>
					<TableRow>
						<TableHead>Email</TableHead>
						<TableHead class="w-28">Role</TableHead>
						<TableHead class="w-12"><span class="sr-only">Actions</span></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each pending as i (i.id)}
						<TableRow>
							<TableCell class="max-w-0 truncate">{i.email}</TableCell>
							<TableCell class="text-muted-foreground">{roleLabel(i.role ?? "member")}</TableCell>
							<TableCell class="text-right">
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label={`Cancel invitation for ${i.email}`}
									disabled={busy}
									onclick={() =>
										act(
											() => unwrap(authClient.organization.cancelInvitation({ invitationId: i.id })),
											"Could not cancel it."
										)}
								>
									<IconTrash />
								</Button>
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</SettingsSection>
	</div>
{/if}

<Dialog bind:open={inviteOpen}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>Invite to {activeOrg.view?.organization.name}</DialogTitle>
			<DialogDescription>They get an email and join after signing in with that address.</DialogDescription>
		</DialogHeader>
		<form id="org-invite" class="flex items-end gap-2" onsubmit={invite}>
			<label class="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium">
				Email
				<Input type="email" required bind:value={inviteEmail} placeholder="name@university.edu" />
			</label>
			<Select bind:value={() => inviteRole, (v) => (inviteRole = v as Role)}>
				<SelectTrigger class="w-auto min-w-28 shrink-0" aria-label="Role">{roleLabel(inviteRole)}</SelectTrigger>
				<SelectContent>
					{#each ROLES.filter((r) => isOwner || r.value !== "owner") as r (r.value)}
						<SelectItem value={r.value}>{r.label}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</form>
		<DialogFooter>
			<Button variant="ghost" onclick={() => (inviteOpen = false)}>Cancel</Button>
			<Button type="submit" form="org-invite" variant="dark" disabled={busy || !inviteEmail.trim()}>
				{#if busy}<IconLoader2 class="animate-spin" />{/if} Send invite
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
