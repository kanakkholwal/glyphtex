<script lang="ts">
	import { Tooltip, TooltipContent, TooltipTrigger } from "@glyphtex/ui/tooltip";
	import { IconCode, IconPencil } from "@tabler/icons-svelte";

	import type { WorkbenchController } from "./controller.svelte";
	import type { DocMode } from "./types";

	/** The document's two editors. Top-level and always visible: everything else
	 *  in the bar is a control *within* whichever one you picked. */
	let { ctrl }: { ctrl: WorkbenchController } = $props();

	const layout = $derived(ctrl.layout);

	const modes: { value: DocMode; label: string; icon: typeof IconPencil; hint?: string }[] = [
		{
			value: "visual",
			label: "Visual",
			icon: IconPencil,
			hint: "Write without the markup. Anything it cannot rewrite is left exactly as you typed it."
		},
		{ value: "latex", label: "LaTeX", icon: IconCode }
	];
</script>

<div
	class="bg-muted dark:bg-background/60 flex shrink-0 items-center gap-0.5 rounded-md p-0.5"
	role="group"
	aria-label="Editor"
>
	{#each modes as mode (mode.value)}
		{@const blocked = mode.value === 'visual' && !ctrl.visualAllowed}
		{@const active = ctrl.docMode === mode.value}
		{@const Icon = mode.icon}
		<Tooltip delayDuration={300}>
			<TooltipTrigger>
				{#snippet child({ props })}
					<button
						{...props}
						class="flex h-6.5 items-center gap-1.5 rounded-[6px] px-2 text-xs font-medium transition-colors {active
							? 'bg-card text-foreground shadow-craft-sm'
							: 'text-muted-foreground hover:text-foreground'} {blocked
							? 'cursor-not-allowed opacity-40'
							: 'cursor-pointer'}"
						aria-pressed={active}
						aria-disabled={blocked}
						onclick={() => {
							if (!blocked) layout.docMode = mode.value;
						}}
					>
						<Icon class="size-3.5" />
						<span class="hidden lg:inline">{mode.label}</span>
					</button>
				{/snippet}
			</TooltipTrigger>
			<!-- Disabled controls must say why, or the only signal is that nothing happened. -->
			<TooltipContent side="bottom">
				{(blocked ? ctrl.visualBlockedReason : mode.hint) ?? mode.label}
			</TooltipContent>
		</Tooltip>
	{/each}
</div>
