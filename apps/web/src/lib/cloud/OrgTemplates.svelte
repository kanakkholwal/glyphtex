<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { Button } from "@glyphtex/ui/button";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconFileText, IconLoader2 } from "@tabler/icons-svelte";

	import CardsSkeleton from "$lib/loading/CardsSkeleton.svelte";

	import { cloud, type OrgTemplate } from "./api";
	import { cloudSession } from "./session.svelte";

	interface Props {
		orgId: string;
	}

	let { orgId }: Props = $props();

	/** Null until the first answer, so the row shows placeholders instead of popping in. */
	let templates = $state.raw<OrgTemplate[] | null>(null);
	let using = $state<string | null>(null);
	const orgName = $derived(cloudSession.orgs.find((o) => o.id === orgId)?.name ?? "Organization");

	$effect(() => {
		const id = orgId;
		cloud.orgs
			.templates(id)
			.then((list) => {
				if (id === orgId) templates = list;
			})
			.catch((e: unknown) => {
				templates = [];
				// The public gallery still works; say why the org's own row is missing.
				toast.error(
					e instanceof Error ? e.message : "Could not load the organization's templates."
				);
			});
	});

	async function use(t: OrgTemplate) {
		using = t.projectId;
		try {
			const project = await cloud.orgs.useTemplate(orgId, t.projectId, t.title);
			await goto(resolve(`/workspace/cloud/${project.id}` as `/workspace/cloud/${string}`));
		} catch (e) {
			toast.error(
				e instanceof Error ? e.message : "Could not create a project from that template."
			);
		} finally {
			using = null;
		}
	}
</script>

{#if templates === null}
	<CardsSkeleton count={3} label="Loading organization templates" />
{:else if templates.length}
	<section aria-labelledby="org-templates-label" class="flex flex-col gap-3">
		<h2
			id="org-templates-label"
			class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
		>
			{orgName}<span class="ml-1.5 tabular-nums">{templates.length}</span>
		</h2>
		<ul class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4" aria-label="Organization templates">
			{#each templates as t (t.projectId)}
				<li class="border-border bg-card flex min-w-0 items-center gap-3 rounded-xl border p-3">
					<span class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
						<IconFileText size={18} aria-hidden="true" />
					</span>
					<div class="min-w-0 flex-1">
						<p class="text-foreground truncate text-sm font-medium">{t.title}</p>
						<p class="text-muted-foreground truncate text-xs">{t.description || t.mainFile}</p>
					</div>
					<Button variant="outline" size="sm" disabled={using !== null} onclick={() => use(t)}>
						{#if using === t.projectId}<IconLoader2 class="animate-spin" />{/if} Use
					</Button>
				</li>
			{/each}
		</ul>
	</section>
{/if}
