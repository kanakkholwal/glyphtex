<script lang="ts" module>
	export type FilterChip = { id: string; label: string; count?: number };
</script>

<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";

	/** Single-choice pill filters; one is always selected, unlike a clearable toggle group. */
	let {
		options,
		value,
		onchange,
		label,
		class: className
	}: {
		options: FilterChip[];
		value: string;
		onchange: (id: string) => void;
		/** Names the group for assistive tech. */
		label: string;
		class?: string;
	} = $props();
</script>

<div class={cn('flex min-w-0 flex-wrap gap-1.5', className)} role="group" aria-label={label}>
	{#each options as option (option.id)}
		{@const active = value === option.id}
		<button
			type="button"
			aria-pressed={active}
			onclick={() => onchange(option.id)}
			class={cn(
				'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm outline-none transition-colors duration-(--duration-fast) ease-(--ease-out) focus-visible:ring-2 focus-visible:ring-ring',
				active
					? 'border-transparent bg-primary text-primary-foreground'
					: 'border-border text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground'
			)}
		>
			{option.label}
			{#if option.count !== undefined}
				<span class={cn('font-mono text-xs tabular-nums', !active && 'text-muted-foreground')}>
					{option.count}
				</span>
			{/if}
		</button>
	{/each}
</div>
