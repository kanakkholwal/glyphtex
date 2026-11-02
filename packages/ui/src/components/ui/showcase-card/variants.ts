import { tv, type VariantProps } from "tailwind-variants";

// The footer row opens on hover or focus, and stays open where there is no hover.
const REVEAL_ROWS = [
	"[&>div]:[grid-template-rows:minmax(0,1fr)_0rem]",
	"hover:[&>div]:[grid-template-rows:minmax(0,1fr)_var(--showcase-footer)] focus-within:[&>div]:[grid-template-rows:minmax(0,1fr)_var(--showcase-footer)]",
	"[@media(hover:none)]:[&>div]:[grid-template-rows:minmax(0,1fr)_var(--showcase-footer)]"
];
const REVEAL_FOOTER = [
	"relative translate-y-2 opacity-0",
	"transition-[opacity,translate] duration-(--duration-dropdown) ease-(--ease-ui-out)",
	"group-hover/showcase:translate-y-0 group-hover/showcase:opacity-100 group-focus-within/showcase:translate-y-0 group-focus-within/showcase:opacity-100",
	"motion-reduce:transition-none [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100"
];

export const showcaseCard = tv({
	slots: {
		root: [
			// isolate: the footer and link z-indexes stay inside the card, under sticky page chrome.
			"@container/showcase group/showcase relative isolate h-full min-w-0 overflow-hidden text-card-foreground",
			"[&>div]:relative [&>div]:h-full [&>div]:min-h-0 [&>div]:grid! [&>div]:gap-0! [&>div]:overflow-hidden [&>div]:py-0!",
			"[&>div]:transition-[grid-template-rows] [&>div]:duration-(--duration-dropdown) [&>div]:ease-(--ease-ui-out) motion-reduce:[&>div]:transition-none"
		],
		preview: [
			"relative min-h-0 overflow-hidden rounded-[inherit]",
			"transition-[border-radius] duration-(--duration-dropdown) ease-(--ease-ui-out) motion-reduce:transition-none"
		],
		footer:
			"pointer-events-none z-30 flex min-h-0 min-w-0 items-center gap-3 overflow-hidden border-border",
		copy: "min-w-0 flex-1",
		title: "font-medium text-foreground text-sm leading-tight",
		description: "mt-1 line-clamp-2 text-muted-foreground text-xs leading-relaxed",
		action: "pointer-events-auto shrink-0",
		link: "absolute inset-0 z-20 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
	},
	variants: {
		variant: {
			solid: {
				root: "[&>div]:[grid-template-rows:minmax(0,1fr)_auto]",
				preview: "rounded-b-none",
				footer: "relative border-t bg-background"
			},
			translucent: {
				root: "[&>div]:[grid-template-rows:minmax(0,1fr)]",
				footer:
					"absolute inset-x-2 bottom-2 rounded-lg border bg-popover/82 shadow-(--overlay-shadow) backdrop-blur-xl backdrop-saturate-150"
			},
			morphing: {
				root: REVEAL_ROWS,
				preview:
					"group-hover/showcase:rounded-b-none group-focus-within/showcase:rounded-b-none [@media(hover:none)]:rounded-b-none",
				footer: [...REVEAL_FOOTER, "border-t bg-background"]
			},
			// The framed Dialog recipe: a card-surface rim, a hairline-bordered preview, the footer in the rim.
			framed: {
				root: [...REVEAL_ROWS, "bg-card p-1 [&>div]:rounded-none [&>div]:bg-transparent"],
				preview: "rounded-[11px] border border-border bg-popover",
				footer: REVEAL_FOOTER
			}
		},
		size: {
			sm: {
				root: "[--showcase-footer:4rem]",
				footer: "px-3 py-2.5",
				description: "line-clamp-1"
			},
			default: { root: "[--showcase-footer:4.75rem]", footer: "px-3.5 py-3" },
			lg: {
				root: "[--showcase-footer:5.5rem]",
				footer: "px-4 py-3.5",
				title: "text-base",
				description: "text-sm"
			}
		}
	},
	// The rim already pads the card, so the framed footer keeps Dialog's tighter rim spacing.
	compoundVariants: [{ variant: "framed", class: { footer: "px-2.5 pt-2 pb-1" } }],
	defaultVariants: { variant: "solid", size: "default" }
});

export type ShowcaseCardVariant = NonNullable<VariantProps<typeof showcaseCard>["variant"]>;
export type ShowcaseCardSize = NonNullable<VariantProps<typeof showcaseCard>["size"]>;
