import { tv, type VariantProps } from "tailwind-variants";

/** The control ladder from DESIGN.md: height, radius, text and icon per shadcn `size`. */
export const controlSize = tv({
	variants: {
		size: {
			xs: "h-6 rounded-sm text-xs [&_svg]:size-3",
			sm: "h-8 rounded-md text-xs [&_svg]:size-3.5",
			default: "h-9 rounded-lg text-sm [&_svg]:size-4",
			lg: "h-10 rounded-lg text-sm [&_svg]:size-4.5",
			xl: "h-12 rounded-xl text-base [&_svg]:size-5"
		}
	},
	defaultVariants: { size: "default" }
});

export type ControlSize = NonNullable<VariantProps<typeof controlSize>["size"]>;

/** One frame for every field. Focus is a ring-coloured border, no halo; a trigger (Select,
 * Combobox) also takes a neutral border while its popup is open. */
export const fieldFrame = tv({
	base: [
		"border border-input bg-(--field) text-foreground outline-none",
		"transition-[color,border-color,box-shadow] duration-(--duration-fast) ease-(--ease-ui-out) motion-reduce:transition-none",
		"hover:bg-[color-mix(in_oklab,var(--field)_97%,var(--foreground))] aria-invalid:border-destructive",
		"disabled:cursor-not-allowed disabled:opacity-50"
	],
	variants: {
		kind: {
			input: "focus-visible:border-ring",
			// Pickers read as a soft fill, not a second outlined field: the edge appears only on keyboard focus.
			trigger: [
				"border-transparent bg-foreground/[0.05] hover:border-transparent hover:bg-foreground/[0.08]",
				"focus-visible:border-ring",
				"data-[popup-open]:bg-foreground/[0.1] data-[state=open]:bg-foreground/[0.1]"
			]
		}
	},
	defaultVariants: { kind: "input" }
});

/**
 * The frame of a composite field (addons, chips, steppers): one edge for the whole group,
 * driven by whichever descendant has focus, is invalid or is disabled.
 * `trigger` stays calm (no halo) and marks an open popup, as fieldFrame does.
 */
export const fieldGroup = tv({
	base: [
		"border border-input bg-[var(--field,var(--background))] text-foreground outline-none",
		"transition-[color,border-color,box-shadow] duration-(--duration-fast) ease-(--ease-ui-out) motion-reduce:transition-none",
		"hover:bg-[color-mix(in_oklab,var(--field)_97%,var(--foreground))] has-[:focus-visible]:border-ring has-[[aria-invalid=true]]:border-destructive aria-invalid:border-destructive",
		"has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50 has-[textarea:disabled]:cursor-not-allowed has-[textarea:disabled]:opacity-50",
		"data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
	],
	variants: {
		kind: {
			input:
				"has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/20 has-[[aria-invalid=true]]:ring-destructive/20 aria-invalid:ring-destructive/20",
			trigger:
				"border-transparent bg-foreground/[0.05] hover:border-transparent hover:bg-foreground/[0.08] has-[[data-popup-open]]:bg-foreground/[0.1] has-[[data-state=open]]:bg-foreground/[0.1]"
		}
	},
	defaultVariants: { kind: "input" }
});

/** The opt-in soft halo around a focused text field: Input and Textarea's `ring` variant. */
export const fieldHalo = tv({
	base: "focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:ring-destructive/20"
});

/** iOS zooms the page into a focused field under 16px, so text entry reads 16px below `md`. */
export const fieldText = tv({
	variants: {
		size: {
			xs: "text-base md:text-xs",
			sm: "text-base md:text-xs",
			default: "text-base md:text-sm",
			lg: "text-base md:text-sm",
			xl: "text-base"
		}
	},
	defaultVariants: { size: "default" }
});
