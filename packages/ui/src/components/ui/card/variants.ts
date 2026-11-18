import { tv, type VariantProps } from "tailwind-variants";

/** `default` is the borderless grey card step; `secondary` steps one further (muted); `framed` adds Dialog's
 * rim; `well` is a grey rim around a raised body. `bordered` adds a hairline to any of them. */
export const cardFrame = tv({
	slots: {
		root: "rounded-2xl border border-border",
		body: "flex flex-col gap-6 py-6 text-card-foreground"
	},
	variants: {
		variant: {
			// Decision (product): surfaces separate by step, not border; `bordered` opts a card back in.
			default: { root: "border-transparent bg-card", body: "" },
			secondary: { root: "border-transparent bg-muted", body: "" },
			ghost: { root: "border-transparent bg-transparent", body: "" },
			framed: {
				root: "border-transparent bg-card p-1",
				body: "rounded-[calc(var(--radius-2xl)-0.25rem)] bg-background"
			},
			// A child selector restyles the rim footer, so CardFooter needs no context (RSC-safe).
			well: {
				root: "border-transparent bg-card p-1 [&>[data-slot=card-footer]]:px-3 [&>[data-slot=card-footer]]:pt-2 [&>[data-slot=card-footer]]:pb-1 [&>[data-slot=card-footer]]:text-muted-foreground [&>[data-slot=card-footer]]:text-xs",
				body: "rounded-[calc(var(--radius-2xl)-0.25rem)] bg-background dark:bg-popover"
			}
		},
		bordered: {
			true: { root: "border-border" },
			false: {}
		}
	},
	defaultVariants: { variant: "default", bordered: false }
});

export type CardVariant = NonNullable<VariantProps<typeof cardFrame>["variant"]>;
