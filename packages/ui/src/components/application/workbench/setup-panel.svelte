<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { PanelSection } from "@glyphtex/ui/panel-section";
	import { Switch } from "@glyphtex/ui/switch";
	import { IconPlus, IconTrash } from "@tabler/icons-svelte";

	import { KNOWN_PACKAGES, providedBy } from "../../../lib/tex-doc/registry";
	import {
		addPackage,
		readDocumentClass,
		readPackages,
		removePackage,
		setPackageEnabled
	} from "../../../lib/tex-doc/preamble";
	import { Input } from "../../ui/input";
	import type { WorkbenchController } from "./controller.svelte";

	// Document-level settings, written back as preamble edits: a switch comments a
	// `\usepackage` out rather than deleting it.
	let { ctrl }: { ctrl: WorkbenchController } = $props();

	const files = $derived(ctrl.files);
	const documentClass = $derived(readDocumentClass(files.source));
	const packages = $derived(readPackages(files.source));
	const loaded = $derived(new Set(packages.flatMap((p) => p.name.split(", "))));

	let query = $state("");
	const matches = $derived(
		query.trim()
			? KNOWN_PACKAGES.filter((p) => !loaded.has(p) && p.includes(query.trim().toLowerCase()))
			: []
	);

	function add(name: string) {
		files.source = addPackage(files.source, name);
		query = "";
	}

	/** A few of the commands a package adds, so a row says what flipping it does. */
	const gist = (name: string) =>
		name
			.split(", ")
			.flatMap((n) => providedBy(n))
			.slice(0, 5)
			.join(", ");
</script>

{#if !documentClass}
	<p class="text-muted-foreground px-3 py-2 text-xs">
		This file has no preamble. Open the main file to change document settings.
	</p>
{:else}
	<div class="flex flex-col gap-5 px-1 pt-1 pb-3">
		<PanelSection title="Document class">
			<p class="px-2 text-sm">
				<span class="font-mono">{documentClass.name}</span>
				{#if documentClass.options}
					<span class="text-muted-foreground font-mono text-xs">[{documentClass.options}]</span>
				{/if}
			</p>
		</PanelSection>

		<PanelSection title="Packages">
			<ul class="flex flex-col">
				{#each packages as pkg (pkg.from)}
					<li class="hover:bg-tint-hover ease-(--ease-out) flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-(--duration-fast)">
						<Switch
							checked={pkg.enabled}
							aria-label="Use {pkg.name}"
							onCheckedChange={(on) => (files.source = setPackageEnabled(files.source, pkg, on))}
						/>
						<div class="min-w-0 flex-1 {pkg.enabled ? '' : 'opacity-60'}">
							<p class="truncate font-mono text-xs">
								{pkg.name}{#if pkg.options}<span class="text-muted-foreground">[{pkg.options}]</span>{/if}
							</p>
							{#if gist(pkg.name)}
								<p class="text-muted-foreground truncate text-xs">{gist(pkg.name)}</p>
							{/if}
						</div>
						<Button
							variant="ghost"
							size="icon-sm"
							title="Remove {pkg.name}"
							aria-label="Remove {pkg.name}"
							onclick={() => (files.source = removePackage(files.source, pkg))}
						>
							<IconTrash />
						</Button>
					</li>
				{:else}
					<li class="text-muted-foreground px-2 py-1.5 text-xs">No packages yet.</li>
				{/each}
			</ul>

			<div class="px-2 pt-2">
				<Input size="sm" placeholder="Add a package" aria-label="Add a package" bind:value={query} />
				{#if matches.length}
					<ul class="mt-1 flex flex-col">
						{#each matches.slice(0, 6) as name (name)}
							<li>
								<button
									type="button"
									class="hover:bg-tint-hover ease-(--ease-out) flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors duration-(--duration-fast)"
									onclick={() => add(name)}
								>
									<IconPlus class="text-muted-foreground size-3.5" />
									<span class="font-mono">{name}</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else if query.trim()}
					<button
						type="button"
						class="hover:bg-tint-hover ease-(--ease-out) mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors duration-(--duration-fast)"
						onclick={() => add(query.trim())}
					>
						<IconPlus class="text-muted-foreground size-3.5" />
						Add <span class="font-mono">{query.trim()}</span>
					</button>
				{/if}
			</div>
		</PanelSection>
	</div>
{/if}
