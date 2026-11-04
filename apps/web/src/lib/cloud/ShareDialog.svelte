<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { Avatar, AvatarFallback, AvatarImage } from "@glyphtex/ui/avatar";
	import { Button } from "@glyphtex/ui/button";
	import { CopyButton } from "@glyphtex/ui/copy-button";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from "@glyphtex/ui/dialog";
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from "@glyphtex/ui/dropdown-menu";
	import { Input } from "@glyphtex/ui/input";
	import { Separator } from "@glyphtex/ui/separator";
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from "@glyphtex/ui/table";
	import { toast } from "@glyphtex/ui/sonner";
	import {
		IconDots,
		IconLink,
		IconLoader2,
		IconLogout,
		IconMail,
		IconTrash
	} from "@tabler/icons-svelte";

	import type { DocumentMeta } from "$lib/documents/store";
	import {
		cloud,
		type GrantableRole,
		type Invite,
		type MembersResponse,
		type ShareLink
	} from "./api";
	import RoleSelect from "./RoleSelect.svelte";
	import { cloudSession } from "./session.svelte";
	import { onboarding } from "$lib/workspace/onboarding.svelte";

	interface Props {
		open: boolean;
		document: DocumentMeta;
	}

	let { open = $bindable(), document }: Props = $props();

	const canShare = $derived(document.capabilities?.includes("project:share") ?? false);
	const me = $derived(cloudSession.user?.id);

	let members = $state<MembersResponse | undefined>(undefined);
	let invites = $state<Invite[]>([]);
	let links = $state<ShareLink[]>([]);
	let loading = $state(false);
	let busy = $state(false);

	let email = $state("");
	let inviteRole = $state<GrantableRole>("editor");
	let linkRole = $state<GrantableRole>("viewer");
	/** The new link's URL: shown once, because the server only keeps its hash. */
	let freshLink = $state<string | undefined>(undefined);

	function fail(error: unknown, fallback: string) {
		toast.error(error instanceof Error ? error.message : fallback);
	}

	async function load() {
		loading = true;
		try {
			const [m, i, l] = await Promise.all([
				cloud.sharing.members(document.id),
				canShare ? cloud.sharing.invites(document.id) : Promise.resolve([]),
				canShare ? cloud.sharing.links(document.id) : Promise.resolve([])
			]);
			members = m;
			invites = i;
			links = l;
		} catch (error) {
			fail(error, "Could not load who has access.");
		} finally {
			loading = false;
		}
	}

	// Each open re-reads: someone else may have changed access since last time.
	$effect(() => {
		if (open) {
			freshLink = undefined;
			void load();
		}
	});

	async function act(run: () => Promise<unknown>, fallback: string, success?: string) {
		busy = true;
		try {
			await run();
			if (success) toast.success(success);
			await load();
		} catch (error) {
			fail(error, fallback);
		} finally {
			busy = false;
		}
	}

	function invite(event: SubmitEvent) {
		event.preventDefault();
		const address = email.trim();
		if (!address) return;
		void act(
			async () => {
				await cloud.sharing.invite(document.id, address, inviteRole);
				onboarding.markShared();
			},
			"Could not send the invite.",
			`Invite sent to ${address}.`
		).then(() => (email = ""));
	}

	function createLink() {
		void act(async () => {
			const link = await cloud.sharing.createLink(document.id, linkRole);
			freshLink = link.url;
			onboarding.markShared();
		}, "Could not create a link.");
	}

	async function leave() {
		if (!me) return;
		await act(() => cloud.sharing.removeMember(document.id, me), "Could not leave the project.");
		open = false;
		void goto(resolve("/workspace"));
	}

	const initials = (name: string) =>
		name
			.split(/[s@.]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase())
			.join("") || "?";
	const roleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);
	const expiry = (iso: string | null) =>
		iso ? `expires ${new Date(iso).toLocaleDateString()}` : "never expires";
</script>

{#snippet who(name: string, email: string, image: string | null)}
	<div class="flex min-w-0 items-center gap-3">
		<Avatar size="sm">
			{#if image}<AvatarImage src={image} alt="" />{/if}
			<AvatarFallback>{initials(name || email)}</AvatarFallback>
		</Avatar>
		<div class="min-w-0">
			<p class="text-foreground truncate text-sm font-medium">{name || email}</p>
			<p class="text-muted-foreground truncate text-xs">{email}</p>
		</div>
	</div>
{/snippet}

{#snippet person(name: string, email: string, image: string | null)}
	<TableRow>
		<TableCell class="max-w-0">{@render who(name, email, image)}</TableCell>
		<TableCell class="text-muted-foreground text-right text-sm">Owner</TableCell>
	</TableRow>
{/snippet}

<Dialog bind:open>
	<DialogContent class="sm:max-w-lg">
		<DialogHeader>
			<DialogTitle>Share “{document.name}”</DialogTitle>
			<DialogDescription>
				{canShare
					? "Invite people by email or create a link. Everyone compiles on their own device."
					: "Only the owner can change who has access."}
			</DialogDescription>
		</DialogHeader>

		{#if canShare}
			<form class="flex items-end gap-2" onsubmit={invite}>
				<label class="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium">
					Email
					<Input type="email" required bind:value={email} placeholder="name@university.edu" />
				</label>
				<RoleSelect value={inviteRole} onchange={(r) => (inviteRole = r)} label="Invite role" />
				<Button type="submit" variant="dark" size="sm" disabled={busy}>
					<IconMail /> Invite
				</Button>
			</form>
		{/if}

		<section class="flex flex-col gap-2" aria-labelledby="share-people">
			<h3 id="share-people" class="sr-only">People with access</h3>
			{#if loading && !members}
				<p class="text-muted-foreground flex items-center gap-2 text-sm" role="status">
					<IconLoader2 size={14} class="animate-spin" /> Loading…
				</p>
			{:else if members}
				<Table variant="framed" class="table-fixed">
					<TableHeader>
						<TableRow>
							<TableHead>People with access</TableHead>
							<TableHead class="w-48 text-right">Role</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if members.owner}
							{@render person(members.owner.name, members.owner.email, members.owner.image)}
						{/if}
						{#each members.members as m (m.userId)}
							<TableRow>
								<TableCell class="max-w-0">
									{@render who(m.name, m.email, m.image)}
								</TableCell>
								<TableCell class="text-right">
									{#if canShare}
										<div class="flex items-center justify-end gap-1">
											<RoleSelect
												value={m.role}
												label={`Role for ${m.email}`}
												disabled={busy}
												onchange={(r) =>
													act(
														() => cloud.sharing.setRole(document.id, m.userId, r),
														"Could not change the role."
													)}
											/>
											<DropdownMenu>
												<DropdownMenuTrigger>
													{#snippet child({ props })}
														<Button
															{...props}
															variant="outline"
															size="icon-sm"
															aria-label={`More for ${m.email}`}
															disabled={busy}
														>
															<IconDots />
														</Button>
													{/snippet}
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" class="w-44">
													<DropdownMenuItem
														destructive
														onclick={() =>
															act(
																() => cloud.sharing.removeMember(document.id, m.userId),
																"Could not remove them."
															)}
													>
														<IconTrash /> Remove access
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
		</section>

		{#if canShare && invites.length > 0}
			<Separator />
			<section class="flex flex-col gap-2" aria-labelledby="share-invites">
				<h3 id="share-invites" class="text-muted-foreground text-xs font-medium">Pending invites</h3>
				<ul class="flex flex-col gap-1">
					{#each invites as i (i.id)}
						<li class="flex items-center gap-2 py-1 text-sm">
							<span class="min-w-0 flex-1 truncate">{i.email}</span>
							<span class="text-muted-foreground text-xs">{roleLabel(i.role)}</span>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={`Revoke invite for ${i.email}`}
								disabled={busy}
								onclick={() =>
									act(() => cloud.sharing.revokeInvite(document.id, i.id), "Could not revoke it.")}
							>
								<IconTrash />
							</Button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if canShare}
			<Separator />
			<section class="flex flex-col gap-2" aria-labelledby="share-links">
				<h3 id="share-links" class="text-muted-foreground text-xs font-medium">Links</h3>
				<div class="flex items-center gap-2">
					<p class="text-muted-foreground min-w-0 flex-1 text-sm">
						Anyone signed in with the link joins as
					</p>
					<RoleSelect value={linkRole} onchange={(r) => (linkRole = r)} label="Link role" />
					<Button variant="outline" size="sm" disabled={busy} onclick={createLink}>
						<IconLink /> Create link
					</Button>
				</div>
				{#if freshLink}
					<div class="bg-muted flex items-center gap-2 rounded-lg px-3 py-2">
						<code class="min-w-0 flex-1 truncate text-xs">{freshLink}</code>
						<CopyButton text={freshLink} />
					</div>
					<p class="text-muted-foreground text-xs">Copy it now: it won't be shown again.</p>
				{/if}
				{#if links.length > 0}
					<ul class="flex flex-col gap-1">
						{#each links as l (l.id)}
							<li class="flex items-center gap-2 py-1 text-sm">
								<span class="min-w-0 flex-1 truncate">
									{roleLabel(l.role)} link · <span class="text-muted-foreground">{expiry(l.expiresAt)}</span>
								</span>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="Revoke link"
									disabled={busy}
									onclick={() =>
										act(() => cloud.sharing.revokeLink(document.id, l.id), "Could not revoke it.", "Link revoked.")}
								>
									<IconTrash />
								</Button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{:else if document.role && document.role !== "owner"}
			<Separator />
			<Button variant="outline" class="self-start" disabled={busy} onclick={leave}>
				<IconLogout /> Leave project
			</Button>
		{/if}
	</DialogContent>
</Dialog>
