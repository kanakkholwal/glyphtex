<script lang="ts" module>
	import type { Snippet } from "svelte";

	export interface SegmentedOption<T extends string = string> {
		value: T;
		label?: string;
		icon?: Snippet;
		disabled?: boolean;
		/** Optional tooltip / a11y title for the segment. */
		title?: string;
	}

	export interface SegmentedProps<T extends string = string> {
		/** Two or more segments. */
		options: SegmentedOption<T>[];
		value: T;
		onValueChange: (next: T) => void;
		/** Sets the row size. Default `sm`. */
		size?: "xs" | "sm" | "md";
		/** Stretch each segment to equal flex-1 width. Default true. */
		fill?: boolean;
		disabled?: boolean;
		class?: string;
		"aria-label"?: string;
	}
</script>

<script lang="ts" generics="T extends string">
	import { CRAFT_FOCUS_RING_INSET, cn } from '@glyphtex/ui/utils';

	let {
		options,
		value,
		onValueChange,
		size = 'sm',
		fill = true,
		disabled = false,
		class: className,
		'aria-label': ariaLabel
	}: SegmentedProps<T> = $props();

	// Animated pill that slides under the active segment. First render skips
	// the transition so the pill doesn't fly in from `left: 0` on mount.
	let containerEl: HTMLDivElement | null = $state(null);
	let pillLeft = $state<number | null>(null);
	let pillWidth = $state<number | null>(null);
	let hasAnimated = $state(false);

	function measure() {
		if (!containerEl) return;
		const active = containerEl.querySelector<HTMLElement>('[data-active="true"]');
		if (!active) {
			pillLeft = null;
			pillWidth = null;
			return;
		}
		pillLeft = active.offsetLeft;
		pillWidth = active.offsetWidth;
	}

	$effect(() => {
		// Re-measure when value/options/size change. ResizeObserver covers
		// container width changes (e.g. panel resize) so the pill stays glued.
		void value;
		void options.length;
		void size;
		measure();
	});

	$effect(() => {
		if (!containerEl || typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver(() => measure());
		ro.observe(containerEl);
		return () => ro.disconnect();
	});

	$effect(() => {
		// Flip the animate flag one tick after first measurement so subsequent
		// value changes animate but the initial render snaps in place.
		if (pillLeft !== null && pillWidth !== null && !hasAnimated) {
			queueMicrotask(() => {
				hasAnimated = true;
			});
		}
	});

	// Every size keeps 2px row padding, so the pill is `calc(100% - 4px)`. `md` matches Button `sm`.
	const sizing = $derived(
		size === 'xs'
			? { row: 'h-6 p-0.5', btn: 'h-5 text-xs px-2', gap: 'gap-0.5' }
			: size === 'md'
				? { row: 'h-8 p-0.5', btn: 'h-7 text-xs px-3', gap: 'gap-0.5' }
				: { row: 'h-7 p-0.5', btn: 'h-6 text-xs px-2.5', gap: 'gap-0.5' }
	);
</script>

<div
	bind:this={containerEl}
	role="radiogroup"
	aria-label={ariaLabel}
	class={cn(
		'relative inline-flex items-center rounded-lg bg-muted ring-1 ring-inset ring-border',
		sizing.row,
		sizing.gap,
		fill && 'w-full',
		disabled && 'opacity-50',
		className
	)}
>
	{#if pillLeft !== null && pillWidth !== null}
		<div
			aria-hidden="true"
			class={cn(
				'pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-md bg-card shadow-xs ring-1 ring-inset ring-border',
				hasAnimated && 'transition-[left,width] duration-300 ease-craft'
			)}
			style:left={`${pillLeft}px`}
			style:width={`${pillWidth}px`}
			style:height="calc(100% - 4px)"
		></div>
	{/if}

	{#each options as option (option.value)}
		{@const active = option.value === value}
		<button
			type="button"
			role="radio"
			aria-checked={active}
			aria-label={option.label ?? option.value}
			title={option.title}
			disabled={disabled || option.disabled}
			data-active={String(active)}
			onclick={() => {
				if (disabled || option.disabled) return;
				if (option.value === value) return;
				onValueChange(option.value);
			}}
			class={cn(
				CRAFT_FOCUS_RING_INSET,
				'relative z-10 inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-150',
				sizing.btn,
				fill && 'flex-1',
				active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
				(disabled || option.disabled) && 'cursor-not-allowed'
			)}
		>
			{#if option.icon}
				<span class="flex shrink-0 items-center justify-center">
					{@render option.icon()}
				</span>
			{/if}
			{#if option.label}
				<span class="truncate">{option.label}</span>
			{/if}
		</button>
	{/each}
</div>
