import { tv, type VariantProps } from "tailwind-variants";

export const seriesMarker = tv({
	slots: {
		layer:
			"transition-[opacity,filter] duration-(--duration-fast) ease-[cubic-bezier(0.42,0,0.58,1)]",
		dot: "",
		ring: "fill-none"
	},
	variants: {
		appearance: {
			solid: { ring: "hidden" },
			ring: {},
			hollow: { dot: "fill-background" }
		}
	},
	defaultVariants: { appearance: "ring" }
});

export type SeriesMarkerAppearance = NonNullable<VariantProps<typeof seriesMarker>["appearance"]>;

export const seriesLoading = tv({
	base: "pointer-events-none fill-none text-foreground [stroke-linecap:round]",
	variants: {
		style: {
			pulse: "[stroke-opacity:0.5]",
			sweep: "[stroke-opacity:0.55]"
		}
	},
	defaultVariants: { style: "pulse" }
});

export type SeriesLoadingStyle = NonNullable<VariantProps<typeof seriesLoading>["style"]>;
