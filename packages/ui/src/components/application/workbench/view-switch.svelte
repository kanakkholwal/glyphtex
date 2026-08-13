<script lang="ts">
	import { Tooltip, TooltipContent, TooltipTrigger } from '@glyphtex/ui/tooltip';
	import { IconCode, IconEye, IconLayoutColumns, IconLayoutRows } from '@tabler/icons-svelte';

	import type { LayoutStore } from './layout.svelte';
	import type { ViewMode } from './types';

	/** How the LaTeX surface is laid out: source, PDF, or both. Icon-only — it sits
	 *  next to the Visual/LaTeX switch, which already carries the words. */
	let { layout }: { layout: LayoutStore } = $props();

	const modes: { value: ViewMode; label: string; icon: typeof IconEye }[] = [
		{ value: 'editor', label: 'Source only', icon: IconCode },
		{ value: 'split', label: 'Source and PDF', icon: IconLayoutColumns },
		{ value: 'preview', label: 'PDF only', icon: IconEye }
	];
</script>

<div class="flex shrink-0 items-center gap-1">
	<div
		class="bg-muted dark:bg-background/60 flex items-center gap-0.5 rounded-md p-0.5"
		role="group"
		aria-label="Layout"
	>
		{#each modes as mode (mode.value)}
			{@const active = layout.viewMode === mode.value}
			{@const Icon = mode.icon}
			<Tooltip delayDuration={300}>
				<TooltipTrigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="grid size-6.5 cursor-pointer place-items-center rounded-[6px] transition-colors {active
								? 'bg-card text-foreground shadow-craft-sm'
								: 'text-muted-foreground hover:text-foreground'}"
							aria-pressed={active}
							aria-label={mode.label}
							onclick={() => (layout.viewMode = mode.value)}
						>
							<Icon class="size-3.5" />
						</button>
					{/snippet}
				</TooltipTrigger>
				<TooltipContent side="bottom">{mode.label}</TooltipContent>
			</Tooltip>
		{/each}
	</div>

	{#if layout.viewMode === 'split'}
		{@const stacked = layout.splitDir === 'vertical'}
		<Tooltip delayDuration={300}>
			<TooltipTrigger>
				{#snippet child({ props })}
					<button
						{...props}
						class="text-muted-foreground hover:bg-accent hover:text-foreground grid size-7 cursor-pointer place-items-center rounded-md transition-colors"
						aria-label={stacked ? 'Stack side by side' : 'Stack vertically'}
						onclick={() => (layout.splitDir = stacked ? 'horizontal' : 'vertical')}
					>
						{#if stacked}<IconLayoutRows class="size-4" />{:else}<IconLayoutColumns
								class="size-4"
							/>{/if}
					</button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent side="bottom">
				{stacked ? 'Stacked — switch to side by side' : 'Side by side — switch to stacked'}
			</TooltipContent>
		</Tooltip>
	{/if}
</div>
