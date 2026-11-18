<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { Input } from "@glyphtex/ui/input";
	import { Skeleton } from "@glyphtex/ui/skeleton";
	import { toast } from "@glyphtex/ui/sonner";
	import { ToggleGroup, ToggleGroupItem } from "@glyphtex/ui/toggle-group";
	import { IconGitPullRequest, IconLoader2 } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { resolve } from "$app/paths";
	import { cloud, CloudError, type GitHost, type GitLink, type GitRepo } from "$lib/cloud/api";
	import { linkedHosts } from "$lib/cloud/git-accounts";
	import type { DocumentMeta } from "$lib/documents/store";
	import { log } from "$lib/log";
	import { sync } from "$lib/sync/sync.svelte";

	let { document }: { document: DocumentMeta } = $props();

	const remoteId = $derived(document.remoteId ?? "");
	const isOwner = $derived(document.role === "owner");
	const canWrite = $derived(document.role === "owner" || document.role === "editor");

	let offered = $state<GitHost[]>([]);
	let connected = $state<GitHost[]>([]);
	let link = $state<GitLink | null>(null);
	let loading = $state(true);
	let busy = $state(false);

	// Linking form
	let host = $state<GitHost | "">("");
	let query = $state("");
	let repos = $state<GitRepo[]>([]);
	let repo = $state("");
	let branches = $state<string[]>([]);
	let branch = $state("");

	// Push form
	let message = $state("");
	let mode = $state<"commit" | "pr">("pr");
	let conflicts = $state<string[]>([]);

	const LABEL: Record<GitHost, string> = {
		github: "GitHub",
		gitlab: "GitLab",
		bitbucket: "Bitbucket"
	};
	const settingsHref = `${resolve("/workspace/settings")}?tab=account`;

	async function load() {
		try {
			const [info, hosts, current] = await Promise.all([
				cloud.info(),
				linkedHosts(),
				cloud.git.link(remoteId)
			]);
			offered = info.gitProviders;
			connected = hosts;
			link = current;
			host = connected[0] ?? "";
		} catch (error) {
			log.error("git tab failed to load", error);
		} finally {
			loading = false;
		}
	}
	onMount(load);

	async function run<T>(task: () => Promise<T>, failure: string): Promise<T | undefined> {
		busy = true;
		try {
			return await task();
		} catch (error) {
			const text = error instanceof CloudError || error instanceof Error ? error.message : failure;
			toast.error(text);
		} finally {
			busy = false;
		}
	}

	async function search() {
		if (!host) return;
		repos =
			(await run(
				() => cloud.git.repos(host as GitHost, query.trim() || undefined),
				"Could not list repositories."
			)) ?? [];
	}

	async function pick(r: GitRepo) {
		repo = r.fullName;
		branch = r.defaultBranch;
		branches =
			(await run(
				() => cloud.git.branches(host as GitHost, r.fullName),
				"Could not list branches."
			)) ?? [];
	}

	async function connectRepo() {
		if (!host || !repo || !branch) return;
		await run(async () => {
			await cloud.git.setLink(remoteId, { provider: host as GitHost, repo, branch });
			await load();
		}, "Could not link the repository.");
	}

	async function pull() {
		const result = await run(() => cloud.git.pull(remoteId), "Could not pull.");
		if (!result) return;
		conflicts = result.conflicts;
		// Bring what the server just received into this browser's copy.
		await sync.run(document.id).catch(() => {});
		await load();
		toast.success(
			result.pulled
				? `Pulled ${result.pulled} file${result.pulled === 1 ? "" : "s"}.`
				: "Already up to date."
		);
	}

	async function push() {
		// Push what is on the server: save local edits there first.
		await sync.run(document.id).catch(() => {});
		const result = await run(() => cloud.git.push(remoteId, { message, mode }), "Could not push.");
		if (!result) return;
		message = "";
		await load();
		if (result.pullRequestUrl) {
			toast.success("Pull request opened.", {
				action: {
					label: "Open",
					onClick: () => window.open(result.pullRequestUrl, "_blank", "noopener")
				}
			});
		} else
			toast.success(
				result.pushed
					? `Pushed ${result.pushed} change${result.pushed === 1 ? "" : "s"}.`
					: "Nothing to push."
			);
	}
</script>

<div class="flex flex-col gap-4">
	{#if loading}
		<div class="flex flex-col gap-2" role="status" aria-busy="true">
			<Skeleton class="h-16 w-full rounded-lg" />
			<span class="sr-only">Loading Git settings</span>
		</div>
	{:else if offered.length === 0}
		<p class="text-muted-foreground text-sm">
			Git sync isn't set up on this server. An admin adds an OAuth app for GitHub, GitLab or Bitbucket.
		</p>
	{:else if link}
		<div class="border-border bg-background flex flex-col gap-1 rounded-xl border p-3">
			<p class="text-foreground text-sm font-medium">{LABEL[link.provider]}: {link.repo}</p>
			<p class="text-muted-foreground text-xs">
				Branch {link.branch}{link.lastSyncedAt ? ` · synced ${new Date(link.lastSyncedAt).toLocaleString()}` : " · not pulled yet"}
			</p>
		</div>
		{#if !connected.includes(link.provider)}
			<p class="text-muted-foreground text-sm">
				Connect your {LABEL[link.provider]} account in <a class="text-foreground underline underline-offset-4" href={settingsHref}>Settings</a> to pull and push.
			</p>
		{:else if canWrite}
			<div class="flex flex-wrap gap-2">
				<Button variant="outline" size="sm" disabled={busy} onclick={pull}>
					{#if busy}<IconLoader2 class="animate-spin" />{/if} Pull
				</Button>
			</div>
			{#if conflicts.length}
				<p class="text-destructive-strong text-sm" role="alert">
					Changed on both sides, left as they were: {conflicts.join(", ")}. Resolve them, then pull again.
				</p>
			{/if}
			<div class="border-border flex flex-col gap-2 border-t border-dashed pt-4">
				<Input placeholder="Commit message" maxlength={500} bind:value={message} />
				<ToggleGroup type="single" bind:value={mode} aria-label="How to push">
					<ToggleGroupItem value="pr">Open a pull request</ToggleGroupItem>
					<ToggleGroupItem value="commit">Commit to {link.branch}</ToggleGroupItem>
				</ToggleGroup>
				<Button variant="dark" size="sm" class="self-start" disabled={busy} onclick={push}>
					<IconGitPullRequest /> Push
				</Button>
				<p class="text-muted-foreground text-xs">Pushing needs a pull first, so nothing newer in the repository is overwritten.</p>
			</div>
		{/if}
		{#if isOwner}
			<Button variant="ghost" size="sm" class="self-start" disabled={busy} onclick={() => run(async () => { await cloud.git.unlink(remoteId); await load(); }, "Could not unlink.")}>
				Unlink repository
			</Button>
		{/if}
	{:else if !isOwner}
		<p class="text-muted-foreground text-sm">The owner hasn't linked a repository yet.</p>
	{:else if connected.length === 0}
		<p class="text-muted-foreground text-sm">
			Connect a Git host in <a class="text-foreground underline underline-offset-4" href={settingsHref}>Settings</a> first.
		</p>
	{:else}
		<div class="flex flex-col gap-3">
			<ToggleGroup type="single" bind:value={host} aria-label="Git host">
				{#each connected as h (h)}<ToggleGroupItem value={h}>{LABEL[h]}</ToggleGroupItem>{/each}
			</ToggleGroup>
			<form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); void search(); }}>
				<Input placeholder="Search your repositories" bind:value={query} />
				<Button type="submit" variant="outline" disabled={busy || !host}>Search</Button>
			</form>
			<ul class="flex max-h-48 flex-col gap-1 overflow-y-auto">
				{#each repos as r (r.fullName)}
					<li>
						<Button variant={repo === r.fullName ? "dark" : "ghost"} size="sm" class="w-full justify-start" onclick={() => pick(r)}>
							{r.fullName}{r.private ? " (private)" : ""}
						</Button>
					</li>
				{/each}
			</ul>
			{#if repo}
				<Input list="git-branches" placeholder="Branch" bind:value={branch} />
				<datalist id="git-branches">{#each branches as b (b)}<option value={b}></option>{/each}</datalist>
				<Button variant="dark" size="sm" class="self-start" disabled={busy || !branch} onclick={connectRepo}>Link {repo}</Button>
			{/if}
		</div>
	{/if}
</div>
