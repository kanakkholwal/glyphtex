<script lang="ts" module>
	import { cn, twMergeConfig, type WithElementRef } from "@glyphtex/ui/utils";
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
	import { tv, type VariantProps } from "tailwind-variants";

	/**
	 * `default` is the near-black action, `primary` the brand accent (one per view), `ink`/`light`
	 * sit on a brand panel. CTA sizes are 40/44/48px; `sm`/`xs` are workbench density only.
	 */
	export const buttonVariants = tv(
		{
			base: [
				"group/button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap select-none",
				"rounded-md border border-transparent bg-clip-padding font-medium outline-none",
				// Never `transition-all`: it animates layout properties too, a reflow per frame on press.
				"transition-[background-color,border-color,color,transform] duration-200 ease-craft",
				"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				"aria-invalid:border-destructive",
				"active:scale-[0.98] active:duration-100",
				"disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
				"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
			].join(" "),
			variants: {
				variant: {
					default: "bg-action text-action-foreground shadow-xs hover:bg-action/90",
					primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-active",
					outline: "border-border bg-card text-foreground hover:bg-muted",
					ghost: "text-foreground hover:bg-muted",
					link: "h-auto px-0 text-primary underline-offset-4 hover:underline active:scale-100",
					ink: "bg-fixed-dark text-fixed-light shadow-xs hover:bg-fixed-dark/90",
					light: "bg-fixed-light text-fixed-dark shadow-xs hover:bg-fixed-light/90",
					destructive:
						"bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
					destructive_soft: "bg-destructive/10 text-destructive hover:bg-destructive/15",
					success: "bg-success text-success-foreground shadow-xs hover:bg-success/90",
					success_soft: "bg-success/10 text-success hover:bg-success/15",
					warning: "bg-warning text-warning-foreground shadow-xs hover:bg-warning/90",
					warning_soft: "bg-warning/10 text-warning hover:bg-warning/15",
					info: "bg-info text-info-foreground shadow-xs hover:bg-info/90",
					info_soft: "bg-info/10 text-info hover:bg-info/15",
					raw: "h-auto w-auto border-0 p-0 active:scale-100",
					// Aliases so older call sites compile.
					brand: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-active",
					brand_soft: "bg-primary/10 text-primary hover:bg-primary/15",
					default_soft: "bg-muted text-foreground hover:bg-surface-strong",
					secondary: "border-border bg-card text-foreground hover:bg-muted",
					dark: "bg-action text-action-foreground shadow-xs hover:bg-action/90"
				},
				size: {
					default: "h-10 px-4 text-body",
					lg: "h-11 px-5 text-body-lg [&_svg:not([class*='size-'])]:size-4.5",
					xl: "h-12 px-6 text-body-lg [&_svg:not([class*='size-'])]:size-5",
					sm: "h-8 px-3 text-sm gap-1.5",
					xs: "h-6 px-2 text-xs gap-1.5 [&_svg:not([class*='size-'])]:size-3.5",
					icon: "size-10 [&_svg:not([class*='size-'])]:size-5",
					"icon-sm": "size-8",
					"icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
					"icon-lg": "size-11 rounded-lg [&_svg:not([class*='size-'])]:size-5",
					"icon-xl": "size-14 rounded-2xl [&_svg:not([class*='size-'])]:size-6",
					raw: ""
				}
			},
			defaultVariants: {
				variant: "default",
				size: "default"
			}
		},
		{ twMergeConfig }
	);

	export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
	export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
