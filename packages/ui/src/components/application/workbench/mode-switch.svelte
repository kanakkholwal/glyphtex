<script lang="ts">
	import { Tooltip, TooltipContent, TooltipTrigger } from '@glyphtex/ui/tooltip';
	import { IconCode, IconPencil } from '@tabler/icons-svelte';

	import type { LayoutStore } from './layout.svelte';
	import type { DocMode } from './types';

	/** The document's two editors. Top-level and always visible — everything else
	 *  in the bar is a control *within* whichever one you picked. */
	let { layout }: { layout: LayoutStore } = $props();

	const modes: { value: DocMode; label: string; icon: typeof IconPencil; hint?: string }[] = [
		{ value: 'visual', label: 'Visual', icon: IconPencil, hint: 'Not shipped yet — preview only' },
		{ value: 'latex', label: 'LaTeX', icon: IconCode }
	];
</script>

<div
	class="bg-muted dark:bg-background/60 flex shrink-0 items-center gap-0.5 rounded-md p-0.5"
	role="group"
	aria-label="Editor"
>
	{#each modes as mode (mode.value)}
		{@const active = layout.docMode === mode.value}
		{@const Icon = mode.icon}
		<Tooltip delayDuration={300}>
			<TooltipTrigger>
				{#snippet child({ props })}
					<button
						{...props}
						class="flex h-6.5 cursor-pointer items-center gap-1.5 rounded-[6px] px-2 text-xs font-medium transition-colors {active
							? 'bg-card text-foreground shadow-craft-sm'
							: 'text-muted-foreground hover:text-foreground'}"
						aria-pressed={active}
						onclick={() => (layout.docMode = mode.value)}
					>
						<Icon class="size-3.5" />
						<span class="hidden lg:inline">{mode.label}</span>
						<!-- A dot, not the word: the label already crowds out below lg, and
						     the pane says it plainly the moment you land there. -->
						{#if mode.hint}
							<span class="bg-warning size-1 shrink-0 rounded-full" aria-hidden="true"></span>
						{/if}
					</button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent side="bottom">{mode.hint ?? mode.label}</TooltipContent>
		</Tooltip>
	{/each}
</div>
