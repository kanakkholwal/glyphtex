<script lang="ts" module>
	import { twMergeConfig } from "@glyphtex/ui/utils";
	import { tv, type VariantProps } from "tailwind-variants";
	export const tabsListVariants = tv(
		{
			base: "rounded-lg p-[3px] group-data-horizontal/tabs:h-9 data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
			variants: {
				variant: {
					default: "bg-muted",
					line: "gap-1 bg-transparent",
					soft: 'bg-muted/60 [&_[data-slot="tabs-trigger"][data-state=active]_svg]:text-primary [&_[data-slot="tabs-trigger"][data-state=active]]:text-foreground [&_[data-slot="tabs-trigger"]]:text-muted-foreground [&_[data-slot="tabs-trigger"]:hover]:text-foreground [&_[data-slot="tabs-trigger"]]:shadow-transparent'
				}
			},
			defaultVariants: {
				variant: "default"
			}
		},
		{ twMergeConfig }
	);
	export type TabsListVariant = VariantProps<typeof tabsListVariants>["variant"];
</script>

<script lang="ts">
	import { cn } from '@glyphtex/ui/utils';
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cubicOut } from 'svelte/easing';
	import { Tween, prefersReducedMotion } from 'svelte/motion';

	let {
		ref = $bindable(null),
		variant = 'default',
		class: className,
		children,
		...restProps
	}: TabsPrimitive.ListProps & {
		variant?: TabsListVariant;
	} = $props();

	// Sliding indicator measured from the DOM, so it stays decoupled from bits-ui's value state.
	let indicatorVisible = $state(false);
	let isVertical = $state(false);
	let firstMeasure = true;

	const x = new Tween(0, { duration: 260, easing: cubicOut });
	const y = new Tween(0, { duration: 260, easing: cubicOut });
	const w = new Tween(0, { duration: 260, easing: cubicOut });
	const h = new Tween(0, { duration: 260, easing: cubicOut });

	function syncIndicator() {
		const el = ref as HTMLElement | null;
		if (!el) return;
		const active = el.querySelector<HTMLElement>('[data-slot="tabs-trigger"][data-state="active"]');
		if (!active) {
			indicatorVisible = false;
			return;
		}
		const listRect = el.getBoundingClientRect();
		const tRect = active.getBoundingClientRect();
		const nx = tRect.left - listRect.left;
		const ny = tRect.top - listRect.top;
		const nw = tRect.width;
		const nh = tRect.height;

		isVertical =
			el.dataset.orientation === 'vertical' || el.closest('[data-orientation="vertical"]') !== null;

		// Snap on first measure so the indicator doesn't grow from (0,0) and fight
		// the dialog/page enter motion. Subsequent updates Tween.
		if (firstMeasure || prefersReducedMotion.current) {
			x.set(nx, { duration: 0 });
			y.set(ny, { duration: 0 });
			w.set(nw, { duration: 0 });
			h.set(nh, { duration: 0 });
			firstMeasure = false;
		} else {
			x.target = nx;
			y.target = ny;
			w.target = nw;
			h.target = nh;
		}
		indicatorVisible = true;
	}

	$effect(() => {
		const el = ref as HTMLElement | null;
		if (!el) return;
		syncIndicator();
		const mo = new MutationObserver(() => syncIndicator());
		mo.observe(el, {
			subtree: true,
			attributes: true,
			attributeFilter: ['data-state']
		});
		const ro = new ResizeObserver(() => syncIndicator());
		ro.observe(el);
		el.querySelectorAll('[data-slot="tabs-trigger"]').forEach((t) => ro.observe(t));
		return () => {
			mo.disconnect();
			ro.disconnect();
		};
	});
</script>

<TabsPrimitive.List
	bind:ref
	data-slot="tabs-list"
	data-variant={variant}
	class={cn(
		'relative',
		tabsListVariants({ variant }),
		// The live indicator owns the active fill; z-10 keeps labels above it.
		indicatorVisible &&
			variant !== 'line' && [
				'[&_[data-slot=tabs-trigger][data-state=active]]:!bg-transparent',
				'[&_[data-slot=tabs-trigger][data-state=active]]:!shadow-none',
				'[&_[data-slot=tabs-trigger]]:z-10'
			],
		indicatorVisible &&
			variant === 'line' && [
				'[&_[data-slot=tabs-trigger][data-state=active]]:after:opacity-0',
				'[&_[data-slot=tabs-trigger]]:z-10'
			],
		className
	)}
	{...restProps}
>
	{#if indicatorVisible && variant !== 'line'}
		<span
			aria-hidden="true"
			class={cn(
				'pointer-events-none absolute left-0 top-0 z-0 rounded-md will-change-transform',
				variant === 'soft' && 'bg-card',
				variant === 'default' && 'bg-background shadow-xs'
			)}
			style="transform: translate({x.current}px, {y.current}px); width: {w.current}px; height: {h.current}px;"
		></span>
	{/if}
	{#if indicatorVisible && variant === 'line'}
		<span
			aria-hidden="true"
			class="pointer-events-none absolute z-0 bg-foreground will-change-transform"
			style={isVertical
				? `transform: translateY(${y.current}px); top: 0; right: -3px; height: ${h.current}px; width: 2px;`
				: `transform: translateX(${x.current}px); bottom: -3px; left: 0; height: 2px; width: ${w.current}px;`}
		></span>
	{/if}
	{@render children?.()}
</TabsPrimitive.List>
