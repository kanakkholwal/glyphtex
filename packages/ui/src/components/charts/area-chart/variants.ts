import { tv, type VariantProps } from "tailwind-variants";

export const area = tv({
	slots: {
		layer: "transition-opacity duration-[400ms] ease-[cubic-bezier(0.42,0,0.58,1)]",
		fill: "stroke-none",
		stroke: "fill-none [stroke-linecap:round] [stroke-linejoin:round]"
	},
	variants: {
		variant: {
			gradient: {},
			solid: { fill: "[fill-opacity:0.28]" },
			pattern: { fill: "[fill-opacity:0.9]" }
		}
	},
	defaultVariants: { variant: "gradient" }
});

export type AreaVariant = NonNullable<VariantProps<typeof area>["variant"]>;
