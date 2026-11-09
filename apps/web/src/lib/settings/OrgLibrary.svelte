<script lang="ts">
	import SectionsSkeleton from "$lib/loading/SectionsSkeleton.svelte";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { Button } from "@glyphtex/ui/button";
	import { Input } from "@glyphtex/ui/input";
	import { Select, SelectContent, SelectItem, SelectTrigger } from "@glyphtex/ui/select";
	import { toast } from "@glyphtex/ui/sonner";
	import {
		IconExternalLink,
		IconLoader2,
		IconPackage,
		IconPlus,
		IconTrash
	} from "@tabler/icons-svelte";

	import { cloud, type OrgLibrary, type OrgTemplate, type ProjectSummary } from "$lib/cloud/api";
	import { cloudSession } from "$lib/cloud/session.svelte";
	import { formatBytes } from "$lib/storage/quota";
	import { activeOrg } from "./org-state.svelte";
	import SettingsSection from "./SettingsSection.svelte";

	const orgId = $derived(cloudSession.activeOrgId);
	const canManage = $derived(activeOrg.can("org:manage-policy"));

	let templates = $state.raw<OrgTemplate[]>([]);
	let library = $state.raw<OrgLibrary | null>(null);
	let projects = $state.raw<ProjectSummary[]>([]);
	let error = $state<string | null>(null);
	let pick = $state("");
	let title = $state("");
	let busy = $state<string | null>(null);

	// Neither a template nor the library itself is offered as a new template.
	const candidates = $derived(
		projects.filter(
			(p) => p.id !== library?.projectId && !templates.some((t) => t.projectId === p.id)
		)
	);
	const picked = $derived(candidates.find((p) => p.id === pick));

	async function load(id: string) {
		try {
			const [t, l, p] = await Promise.all([
				cloud.orgs.templates(id),
				cloud.orgs.library(id),
				canManage ? cloud.orgs.projects(id) : Promise.resolve([])
			]);
			templates = t;
			library = l;
			projects = p;
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : "Could not load the library.";
		}
	}

	$effect(() => {
		if (orgId) void load(orgId);
	});

	async function act(key: string, task: () => Promise<void>, failure: string) {
		busy = key;
		try {
			await task();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : failure);
		} finally {
			busy = null;
		}
	}

	const addTemplate = (event: SubmitEvent) => {
		event.preventDefault();
		if (!orgId || !picked) return;
		const id = orgId;
		void act(
			"add",
			async () => {
				await cloud.orgs.saveTemplate(id, picked.id, title.trim() || picked.name);
				pick = "";
				title = "";
				await load(id);
				toast.success("Template added.");
			},
			"Could not save the template."
		);
	};

	const removeTemplate = (t: OrgTemplate) => {
		if (!orgId) return;
		const id = orgId;
		void act(
			t.projectId,
			async () => {
				await cloud.orgs.removeTemplate(id, t.projectId);
				await load(id);
			},
			"Could not remove the template."
		);
	};

	const openLibrary = () => {
		if (!orgId) return;
		const id = orgId;
		void act(
			"library",
			async () => {
				const projectId = library?.projectId ?? (await cloud.orgs.ensureLibrary(id));
				await goto(resolve(`/workspace/cloud/${projectId}` as `/workspace/cloud/${string}`));
			},
			"Could not open the shared packages."
		);
	};
</script>

{#if error}
	<p class="text-destructive-strong text-sm">{error}</p>
{:else if library}
	<div class="flex flex-col gap-10">
		<SettingsSection
			title="Templates"
			description="Organization projects members can start from. They appear first on the Templates page."
		>
			<ul class="border-border bg-card divide-border flex flex-col divide-y rounded-xl border">
				{#each templates as t (t.projectId)}
					<li class="flex items-center gap-4 p-4">
						<div class="min-w-0 flex-1">
							<p class="text-foreground truncate text-sm font-medium">{t.title}</p>
							<p class="text-muted-foreground truncate text-sm">{t.description || t.mainFile}</p>
						</div>
						{#if canManage}
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={`Remove ${t.title}`}
								disabled={busy === t.projectId}
								onclick={() => removeTemplate(t)}
							>
								<IconTrash />
							</Button>
						{/if}
					</li>
				{:else}
					<li class="text-muted-foreground p-4 text-sm">No templates yet.</li>
				{/each}
				{#if canManage}
					<li>
						<form class="flex flex-wrap items-end gap-3 p-4" onsubmit={addTemplate}>
							<label class="flex min-w-48 flex-1 flex-col gap-1.5 text-xs font-medium">
								Project
								<Select bind:value={pick} disabled={candidates.length === 0}>
									<SelectTrigger class="w-full" aria-label="Project to use as a template">
										{picked?.name ??
											(candidates.length ? "Choose a project" : "No organization projects")}
									</SelectTrigger>
									<SelectContent>
										{#each candidates as p (p.id)}
											<SelectItem value={p.id}>{p.name}</SelectItem>
										{/each}
									</SelectContent>
								</Select>
							</label>
							<label class="flex min-w-48 flex-1 flex-col gap-1.5 text-xs font-medium">
								Title
								<Input bind:value={title} placeholder={picked?.name ?? "Lab report"} maxlength={120} />
							</label>
							<Button type="submit" variant="outline" size="sm" disabled={!picked || busy === "add"}>
								{#if busy === "add"}<IconLoader2 class="animate-spin" />{:else}<IconPlus />{/if}
								Add template
							</Button>
						</form>
					</li>
				{/if}
			</ul>
		</SettingsSection>

		<SettingsSection
			title="Shared packages"
			description="Class files, styles, bibliographies and fonts added to every compile of this organization's projects."
		>
			{#snippet action()}
				{#if canManage}
					<Button variant="outline" size="sm" disabled={busy === "library"} onclick={openLibrary}>
						{#if busy === "library"}<IconLoader2 class="animate-spin" />{:else}<IconExternalLink />{/if}
						{library?.projectId ? "Edit" : "Set up"}
					</Button>
				{/if}
			{/snippet}
			<ul class="border-border bg-card divide-border flex flex-col divide-y rounded-xl border">
				{#each library.files as f (f.path)}
					<li class="flex items-center gap-3 px-4 py-3">
						<IconPackage size={16} class="text-muted-foreground shrink-0" aria-hidden="true" />
						<span class="text-foreground min-w-0 flex-1 truncate font-mono text-sm">{f.path}</span>
						<span class="text-muted-foreground text-sm tabular-nums">{formatBytes(f.size)}</span>
					</li>
				{:else}
					<li class="text-muted-foreground p-4 text-sm">
						{canManage
							? "Set up a shared project, then add .sty, .cls, .bst or font files to it."
							: "Your admins haven't added shared packages."}
					</li>
				{/each}
			</ul>
		</SettingsSection>
	</div>
{:else}
	<SectionsSkeleton sections={2} label="Loading templates and packages" />
{/if}
