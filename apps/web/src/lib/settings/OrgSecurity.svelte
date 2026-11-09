<script lang="ts">
	import { Badge } from "@glyphtex/ui/badge";
	import { Button } from "@glyphtex/ui/button";
	import { CopyButton } from "@glyphtex/ui/copy-button";
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
	import { IconKey, IconLoader2, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-svelte";

	import { cloud, type ScimOverview, type ScimToken, type SsoProvider } from "$lib/cloud/api";
	import { authClient, unwrap } from "$lib/cloud/auth";
	import { SERVER_URL } from "$lib/cloud/config";
	import { cloudSession } from "$lib/cloud/session.svelte";
	import SettingsSection from "./SettingsSection.svelte";

	const orgId = $derived(cloudSession.activeOrgId);

	let providers = $state.raw<SsoProvider[]>([]);
	let scim = $state.raw<ScimOverview | null>(null);
	let error = $state<string | null>(null);
	let busy = $state<string | null>(null);
	/** Shown once, right after a token is minted. */
	let fresh = $state<ScimToken | null>(null);
	let removing = $state<string | null>(null);
	/** DNS instructions per provider id, filled when a verification is requested. */
	let dns = $state<Record<string, { name: string; value: string }>>({});

	let issuer = $state("");
	let domain = $state("");
	let clientId = $state("");
	let clientSecret = $state("");

	const providerId = $derived(
		domain
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
	);
	const callbackFor = (id: string) => `${SERVER_URL}/api/auth/sso/callback/${id || "<provider>"}`;

	async function load(id: string) {
		try {
			const [p, s] = await Promise.all([cloud.orgs.ssoProviders(id), cloud.orgs.scim(id)]);
			providers = p;
			scim = s;
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : "Could not load security settings.";
		}
	}

	$effect(() => {
		if (orgId) void load(orgId);
	});

	async function act(key: string, task: (id: string) => Promise<void>, failure: string) {
		if (!orgId) return;
		busy = key;
		try {
			await task(orgId);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : failure);
		} finally {
			busy = null;
		}
	}

	const addProvider = (event: SubmitEvent) => {
		event.preventDefault();
		void act(
			"add",
			async (id) => {
				await unwrap(
					authClient.sso.register({
						providerId,
						issuer: issuer.trim(),
						domain: domain.trim().toLowerCase(),
						organizationId: id,
						oidcConfig: {
							clientId: clientId.trim(),
							clientSecret: clientSecret.trim(),
							scopes: ["openid", "email", "profile"],
							pkce: true
						}
					})
				);
				issuer = domain = clientId = clientSecret = "";
				await load(id);
				toast.success("Provider added. Verify the domain to switch it on.");
			},
			"Could not add the provider."
		);
	};

	const requestDns = (p: SsoProvider) =>
		void act(
			`dns:${p.providerId}`,
			async () => {
				const { domainVerificationToken } = await unwrap(
					authClient.sso.requestDomainVerification({ providerId: p.providerId })
				);
				const label = `_better-auth-token-${p.providerId}`;
				dns = {
					...dns,
					[p.providerId]: {
						name: `${label}.${p.domain}`,
						value: `${label}=${domainVerificationToken}`
					}
				};
			},
			"Could not create the DNS record."
		);

	const verify = (p: SsoProvider) =>
		void act(
			`verify:${p.providerId}`,
			async (id) => {
				await unwrap(authClient.sso.verifyDomain({ providerId: p.providerId }));
				await load(id);
				toast.success(`${p.domain} is verified.`);
			},
			"The DNS record isn't visible yet. It can take a few minutes."
		);

	const addScim = () =>
		void act(
			"scim-add",
			async (id) => {
				fresh = await cloud.orgs.createScim(id, 365);
				await load(id);
			},
			"Could not create the connection."
		);

	const rotate = (connectionId: string) =>
		void act(
			`rotate:${connectionId}`,
			async (id) => {
				fresh = await cloud.orgs.rotateScim(id, connectionId, 365);
			},
			"Could not rotate the token."
		);

	const confirmRemove = () => {
		const connectionId = removing;
		if (!connectionId) return;
		void act(
			"remove",
			async (id) => {
				await cloud.orgs.removeScim(id, connectionId);
				removing = null;
				await load(id);
			},
			"Could not remove the connection."
		);
	};
</script>

{#if error}
	<p class="text-destructive-strong text-sm">{error}</p>
{:else if scim}
	<div class="flex flex-col gap-10">
		<SettingsSection
			title="Single sign-on"
			description="Members sign in with your identity provider. Each domain is proven with a DNS record before it can sign anyone in."
		>
			<ul class="border-border bg-card divide-border flex flex-col divide-y rounded-xl border">
				{#each providers as p (p.providerId)}
					<li class="flex flex-col gap-3 p-4">
						<div class="flex items-center gap-3">
							<div class="min-w-0 flex-1">
								<p class="text-foreground truncate text-sm font-medium">{p.domain}</p>
								<p class="text-muted-foreground truncate text-xs">
									{p.type.toUpperCase()} · {p.issuer}
								</p>
							</div>
							{#if p.domainVerified}
								<Badge variant="success">Verified</Badge>
							{:else}
								<Badge variant="warning">Needs DNS</Badge>
								<Button
									variant="outline"
									size="sm"
									disabled={busy !== null}
									onclick={() => requestDns(p)}
								>
									{#if busy === `dns:${p.providerId}`}<IconLoader2 class="animate-spin" />{/if}
									Get DNS record
								</Button>
							{/if}
						</div>
						<div class="text-muted-foreground flex items-center gap-2 text-xs">
							<span class="shrink-0">Redirect URL</span>
							<code class="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1">{callbackFor(p.providerId)}</code>
							<CopyButton text={callbackFor(p.providerId)} />
						</div>
						{#if !p.domainVerified && dns[p.providerId]}
							{@const record = dns[p.providerId]}
							<div class="bg-muted flex flex-col gap-2 rounded-lg p-3 text-xs">
								<p class="text-foreground font-medium">Add this TXT record, then check.</p>
								<div class="flex items-center gap-2">
									<span class="text-muted-foreground w-12 shrink-0">Name</span>
									<code class="min-w-0 flex-1 break-all">{record?.name}</code>
									<CopyButton text={record?.name ?? ""} />
								</div>
								<div class="flex items-center gap-2">
									<span class="text-muted-foreground w-12 shrink-0">Value</span>
									<code class="min-w-0 flex-1 break-all">{record?.value}</code>
									<CopyButton text={record?.value ?? ""} />
								</div>
								<Button
									size="sm"
									variant="dark"
									class="self-start"
									disabled={busy !== null}
									onclick={() => verify(p)}
								>
									{#if busy === `verify:${p.providerId}`}<IconLoader2 class="animate-spin" />{/if}
									Check record
								</Button>
							</div>
						{/if}
					</li>
				{:else}
					<li class="text-muted-foreground p-4 text-sm">No identity provider yet.</li>
				{/each}
				<li>
					<form class="grid gap-3 p-4 sm:grid-cols-2" onsubmit={addProvider}>
						<label class="flex flex-col gap-1.5 text-xs font-medium">
							Email domain
							<Input required placeholder="acme.com" bind:value={domain} />
						</label>
						<label class="flex flex-col gap-1.5 text-xs font-medium">
							Issuer URL
							<Input
								required
								type="url"
								placeholder="https://login.acme.com"
								bind:value={issuer}
							/>
						</label>
						<label class="flex flex-col gap-1.5 text-xs font-medium">
							Client ID
							<Input required autocomplete="off" bind:value={clientId} />
						</label>
						<label class="flex flex-col gap-1.5 text-xs font-medium">
							Client secret
							<Input required type="password" autocomplete="off" bind:value={clientSecret} />
						</label>
						<p class="text-muted-foreground text-xs sm:col-span-2">
							Register this redirect URL with your provider: <code>{callbackFor(providerId)}</code>
						</p>
						<Button
							type="submit"
							variant="outline"
							size="sm"
							class="self-start"
							disabled={busy !== null || !providerId}
						>
							{#if busy === "add"}<IconLoader2 class="animate-spin" />{:else}<IconPlus />{/if}
							Add OpenID Connect provider
						</Button>
					</form>
				</li>
			</ul>
		</SettingsSection>

		<SettingsSection
			title="Directory sync (SCIM)"
			description="Your identity provider adds and removes members automatically. Owners are never removed this way."
		>
			{#snippet action()}
				<Button variant="outline" size="sm" disabled={busy !== null} onclick={addScim}>
					{#if busy === "scim-add"}<IconLoader2 class="animate-spin" />{:else}<IconPlus />{/if}
					Add connection
				</Button>
			{/snippet}
			{#if fresh}
				<div class="border-primary bg-card flex flex-col gap-3 rounded-xl border p-4" role="status">
					<p class="text-foreground text-sm font-medium">Copy these now. The token won't be shown again.</p>
					<div class="flex items-center gap-2 text-xs">
						<span class="text-muted-foreground w-20 shrink-0">Base URL</span>
						<code class="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1">{fresh.url}</code>
						<CopyButton text={fresh.url} />
					</div>
					<div class="flex items-center gap-2 text-xs">
						<span class="text-muted-foreground w-20 shrink-0">Bearer token</span>
						<code class="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1">{fresh.token}</code>
						<CopyButton text={fresh.token} />
					</div>
					<Button variant="ghost" size="sm" class="self-start" onclick={() => (fresh = null)}>Done</Button>
				</div>
			{/if}
			<ul class="border-border bg-card divide-border flex flex-col divide-y rounded-xl border">
				{#each scim.connections as c (c.connectionId)}
					<li class="flex items-center gap-3 p-4">
						<IconKey size={16} class="text-muted-foreground shrink-0" aria-hidden="true" />
						<div class="min-w-0 flex-1">
							<p class="text-foreground truncate font-mono text-sm">{c.connectionId}</p>
							<p class="text-muted-foreground text-xs">
								Created {new Date(c.createdAt).toLocaleDateString()}
							</p>
						</div>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Rotate token"
							disabled={busy !== null}
							onclick={() => rotate(c.connectionId)}
						>
							<IconRefresh />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Remove connection"
							disabled={busy !== null}
							onclick={() => (removing = c.connectionId)}
						>
							<IconTrash />
						</Button>
					</li>
				{:else}
					<li class="text-muted-foreground p-4 text-sm">No directory connected.</li>
				{/each}
			</ul>
		</SettingsSection>
	</div>

	<Dialog bind:open={() => removing !== null, (open) => !open && (removing = null)}>
		<DialogContent class="sm:max-w-md">
			<DialogHeader>
				<DialogTitle>Remove this connection?</DialogTitle>
				<DialogDescription>
					Its token stops working at once. Members already added stay until you remove them.
				</DialogDescription>
			</DialogHeader>
			<DialogFooter>
				<Button variant="ghost" onclick={() => (removing = null)}>Cancel</Button>
				<Button variant="destructive" disabled={busy === "remove"} onclick={confirmRemove}>
					{#if busy === "remove"}<IconLoader2 class="animate-spin" />{/if} Remove
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
{:else}
	<p class="text-muted-foreground flex items-center gap-2 text-sm" role="status">
		<IconLoader2 size={14} class="animate-spin" /> Loading…
	</p>
{/if}
