<script lang="ts">
	import { Tooltip, TooltipContent, TooltipTrigger } from '@glyphtex/ui/tooltip';
	import { IconFiles, IconGitBranch, IconSearch } from '@tabler/icons-svelte';

	import type { ActivityView } from './types';

	/** Which view the panel is showing. Notion's shape: the active one carries its
	 *  label, the rest are icons: three labelled tabs do not fit a 200px rail. */
	let {
		active = 'files',
		gitReady = true,
		onselect
	}: {
		active?: ActivityView;
		/** Hides Changes entirely. Source control is desktop-only. */
		gitReady?: boolean;
		onselect?: (view: ActivityView) => void;
	} = $props();

	const ALL: { id: ActivityView; label: string; icon: typeof IconFiles }[] = [
		{ id: 'files', label: 'Project', icon: IconFiles },
		{ id: 'search', label: 'Search', icon: IconSearch },
		{ id: 'git', label: 'Changes', icon: IconGitBranch }
	];
	const views = $derived(ALL.filter((v) => v.id !== 'git' || gitReady));
</script>

<div class="flex min-w-0 items-center gap-0.5" role="group" aria-label="Panel views">
	{#each views as view (view.id)}
		{@const on = active === view.id}
		{@const Icon = view.icon}
		<Tooltip delayDuration={300}>
			<TooltipTrigger>
				{#snippet child({ props })}
					<!-- The label is always in the DOM and animates its own width open;
					     `auto` widths cannot be transitioned, and swapping the span in and
					     out would make the pill jump rather than grow. -->
					<button
						{...props}
						class="ease-craft flex h-7 cursor-pointer items-center rounded-md transition-[background-color,color,padding,column-gap] duration-200 motion-reduce:transition-none {on
							? 'bg-accent text-foreground gap-1.5 px-2 font-medium'
							: 'text-muted-foreground hover:bg-accent hover:text-foreground gap-0 px-1.5'}"
						aria-pressed={on}
						aria-label={view.label}
						onclick={() => onselect?.(view.id)}
					>
						<Icon class="size-4 shrink-0" />
						<span
							class="ease-craft overflow-hidden text-xs whitespace-nowrap transition-[max-width,opacity] duration-200 motion-reduce:transition-none {on
								? 'max-w-24 opacity-100'
								: 'max-w-0 opacity-0'}"
						>
							{view.label}
						</span>
					</button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent side="bottom">{view.label}</TooltipContent>
		</Tooltip>
	{/each}
</div>
