<script lang="ts">
	import { Tooltip, TooltipContent, TooltipTrigger } from "@glyphtex/ui/tooltip";
	import { IconLayoutSidebar, IconLayoutSidebarRight } from "@tabler/icons-svelte";

	import { shortcutLabel } from "../shortcuts";
	import type { WorkbenchController } from "./controller.svelte";
	import EditorTabs from "./editor-tabs.svelte";

	// Open file plus the panel seam, above the mode split: a mode is a lens on one file.
	let { ctrl }: { ctrl: WorkbenchController } = $props();

	const files = $derived(ctrl.files);
	const layout = $derived(ctrl.layout);
	const quiet = $derived(ctrl.docMode === "visual");
</script>

{#snippet sidebarToggle()}
	<!-- On the seam it controls, where the panel re-emerges, following it when docked right. -->
	<div class="flex shrink-0 items-center {layout.sidebarRight ? 'pr-1.5 pl-0.5' : 'pr-0.5 pl-1.5'}">
		{#if layout.sidebarRight}
			<span class="bg-border/60 mr-1 h-4 w-px shrink-0" aria-hidden="true"></span>
		{/if}
		<Tooltip delayDuration={400}>
			<TooltipTrigger>
				{#snippet child({ props })}
					<button
						{...props}
						class="text-muted-foreground hover:bg-muted/60 hover:text-foreground ease-craft grid size-7 shrink-0 place-items-center rounded-md transition-colors duration-150 motion-reduce:transition-none"
						aria-label="Toggle sidebar"
						aria-pressed={!layout.panelCollapsed}
						onclick={() => (layout.panelCollapsed = !layout.panelCollapsed)}
					>
						{#if layout.sidebarRight}
							<IconLayoutSidebarRight size={16} class={layout.panelCollapsed ? 'opacity-60' : ''} />
						{:else}
							<IconLayoutSidebar size={16} class={layout.panelCollapsed ? 'opacity-60' : ''} />
						{/if}
					</button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent side="bottom">
				{layout.panelCollapsed ? 'Show' : 'Hide'} sidebar ({shortcutLabel('toggle-sidebar')})
			</TooltipContent>
		</Tooltip>
		{#if !layout.sidebarRight}
			<span class="bg-border/60 ml-1 h-4 w-px shrink-0" aria-hidden="true"></span>
		{/if}
	</div>
{/snippet}

<!-- Plain toolbar rail; in Visual it goes translucent so the prose page reads through. -->
<div
	class="ease-craft flex h-9 shrink-0 items-stretch border-b transition-colors duration-200 motion-reduce:transition-none {quiet
		? 'glyphtex-tab-rail--quiet border-border/50'
		: 'border-border bg-background'}"
>
	{#if !layout.sidebarRight}{@render sidebarToggle()}{/if}
	<EditorTabs {files} onnew={() => files.newFile()} />
	{#if layout.sidebarRight}{@render sidebarToggle()}{/if}
</div>

<style>
	.glyphtex-tab-rail--quiet {
		background: color-mix(in oklab, var(--background) 72%, transparent);
		backdrop-filter: blur(12px) saturate(160%);
	}
	@media (prefers-reduced-transparency: reduce) {
		.glyphtex-tab-rail--quiet {
			background: var(--background);
			backdrop-filter: none;
		}
	}
</style>
