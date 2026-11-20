<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { toast } from "@glyphtex/ui/sonner";
	import {
		IconBrandBitbucket,
		IconBrandGithub,
		IconBrandGitlab,
		IconLoader2
	} from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { page } from "$app/state";
	import { cloud, type GitHost } from "$lib/cloud/api";
	import { linkedHosts, linkHost, unlinkHost } from "$lib/cloud/git-accounts";
	import { log } from "$lib/log";
	import SettingsSection from "./SettingsSection.svelte";

	const HOSTS = {
		github: { label: "GitHub", icon: IconBrandGithub },
		gitlab: { label: "GitLab", icon: IconBrandGitlab },
		bitbucket: { label: "Bitbucket", icon: IconBrandBitbucket }
	} as const;

	let offered = $state<GitHost[]>([]);
	let connected = $state<GitHost[]>([]);
	let loaded = $state(false);
	let busy = $state<GitHost | null>(null);

	async function load() {
		try {
			const [info, hosts] = await Promise.all([cloud.info(), linkedHosts()]);
			offered = info.gitProviders;
			connected = hosts;
		} catch (error) {
			log.error("git connections failed to load", error);
		} finally {
			loaded = true;
		}
	}

	onMount(() => {
		void load();
		// The host sends the browser back here with the outcome in the URL.
		const status = page.url.searchParams.get("status");
		const host = page.url.searchParams.get("git");
		if (host && status === "connected")
			toast.success(`Connected ${HOSTS[host as GitHost]?.label ?? host}.`);
		else if (host && status) toast.error("The connection did not complete. Try again.");
	});

	async function connect(host: GitHost) {
		busy = host;
		try {
			await linkHost(host);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not start the connection.");
			busy = null;
		}
	}

	async function disconnect(host: GitHost) {
		busy = host;
		try {
			await unlinkHost(host);
			await load();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not disconnect.");
		} finally {
			busy = null;
		}
	}
</script>

{#if loaded}
	<SettingsSection
		title="Git hosts"
		description="Connect GitHub, GitLab or Bitbucket to sync a project with a repository. Each person connects their own account."
	>
		{#if offered.length === 0}
			<p class="bg-tint text-muted-foreground rounded-xl p-4 text-sm">
				Git sync isn't set up on this server. An admin adds an OAuth app for a host in the server settings.
			</p>
		{:else}
			<ul class="bg-tint divide-border divide-y rounded-xl">
				{#each offered as host (host)}
					{@const Icon = HOSTS[host].icon}
					<li class="flex items-center gap-3 p-4">
						<Icon class="text-muted-foreground size-5 shrink-0" />
						<div class="min-w-0 flex-1">
							<p class="text-foreground text-sm font-medium">{HOSTS[host].label}</p>
							<p class="text-muted-foreground truncate text-sm">
								{connected.includes(host) ? "Connected" : "Not connected"}
							</p>
						</div>
						{#if connected.includes(host)}
							<Button variant="outline" size="sm" disabled={busy === host} onclick={() => disconnect(host)}>Disconnect</Button>
						{:else}
							<Button variant="dark" size="sm" disabled={busy === host} onclick={() => connect(host)}>
								{#if busy === host}<IconLoader2 class="animate-spin" />{/if} Connect
							</Button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</SettingsSection>
{/if}
