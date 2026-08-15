<script lang="ts">
	import { Tooltip, TooltipContent, TooltipTrigger } from '@glyphtex/ui/tooltip';
	import { IconLayoutSidebar, IconLayoutSidebarRight } from '@tabler/icons-svelte';

	import { shortcutLabel } from '../shortcuts';
	import type { WorkbenchController } from './controller.svelte';
	import EditorTabs from './editor-tabs.svelte';

	/** Which file is open, and the panel seam beside it. It sits above the
	 *  Visual/LaTeX split because the answer is the same in both: a mode is a lens
	 *  on one file, not a place with its own file set. Layout, export and compile
	 *  are page-global and live in the title bar. */
	let { ctrl }: { ctrl: WorkbenchController } = $props();

	const files = $derived(ctrl.files);
	const layout = $derived(ctrl.layout);
	const quiet = $derived(ctrl.docMode === 'visual');
</script>

{#snippet sidebarToggle()}
	<!-- On the seam it controls, not 1200px away in the title bar's right cluster.
	     It also sits exactly where the panel re-emerges from, and follows the panel
	     when it is docked right. -->
	<div class="flex shrink-0 items-center {layout.sidebarRight ? 'pr-1.5 pl-0.5' : 'pr-0.5 pl-1.5'}">
		{#if layout.sidebarRight}
			<span class="bg-border/60 mr-1 h-4 w-px shrink-0" aria-hidden="true"></span>
		{/if}
		<Tooltip delayDuration={400}>
			<TooltipTrigger>
				{#snippet child({ props })}
					<button
						{...props}
						class="text-muted-foreground hover:bg-accent/60 hover:text-foreground ease-craft grid size-7 shrink-0 place-items-center rounded-md transition-colors duration-150 motion-reduce:transition-none"
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

<!-- A recessed rail the active chip lifts off, same surface + shadow the mode
     switch uses. In Visual the rail goes translucent and lets the prose page read
     through it; the chips themselves are identical in both. -->
<div
	class="ease-craft flex h-9 shrink-0 items-stretch border-b transition-colors duration-200 motion-reduce:transition-none {quiet
		? 'glyphtex-tab-rail--quiet border-border/50'
		: 'border-border bg-muted dark:bg-card'}"
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
