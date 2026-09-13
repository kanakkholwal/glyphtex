<script lang="ts" module>
	import { twMergeConfig } from "@glyphtex/ui/utils";
	import { type VariantProps, tv } from "tailwind-variants";

	// Status badges carry a word or glyph as well as the tint: colour is never the only signal.
	export const badgeVariants = tv(
		{
			base: "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border border-transparent px-2 py-0.5 text-caption font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
			variants: {
				variant: {
					default: "bg-action text-action-foreground [a]:hover:bg-action/90",
					primary: "bg-primary/10 text-primary [a]:hover:bg-primary/15",
					secondary: "bg-muted text-foreground [a]:hover:bg-surface-strong",
					destructive: "bg-destructive/10 text-destructive [a]:hover:bg-destructive/15",
					success: "bg-success/10 text-success [a]:hover:bg-success/15",
					warning: "bg-warning/10 text-warning [a]:hover:bg-warning/15",
					info: "bg-info/10 text-info [a]:hover:bg-info/15",
					outline: "border-border text-foreground [a]:hover:bg-muted",
					ghost: "text-muted-foreground hover:bg-muted",
					link: "text-primary underline-offset-4 hover:underline",
					brand: "bg-primary/10 text-primary [a]:hover:bg-primary/15"
				}
			},
			defaultVariants: {
				variant: "default"
			}
		},
		{ twMergeConfig }
	);

	export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
</script>

<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '@glyphtex/ui/utils';

	let {
		ref = $bindable(null),
		href,
		class: className,
		variant = 'default',
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant;
	} = $props();
</script>

<svelte:element
	this={href ? 'a' : 'span'}
	bind:this={ref}
	data-slot="badge"
	{href}
	class={cn(badgeVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
