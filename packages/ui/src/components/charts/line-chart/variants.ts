import {
	type CurveFactory,
	curveLinear,
	curveMonotoneX,
	curveNatural,
	curveStepAfter
} from "d3-shape";
import { tv, type VariantProps } from "tailwind-variants";

export const line = tv({
	base: "fill-none [stroke-linecap:round] transition-opacity duration-[400ms] ease-[cubic-bezier(0.42,0,0.58,1)]",
	variants: {
		curve: {
			natural: "[stroke-linejoin:round]",
			monotone: "[stroke-linejoin:round]",
			linear: "[stroke-linejoin:round]",
			step: "[stroke-linejoin:miter]"
		},
		variant: {
			solid: "",
			dashed: "[stroke-dasharray:6_4]"
		}
	},
	defaultVariants: { curve: "natural", variant: "solid" }
});

export type LineCurve = NonNullable<VariantProps<typeof line>["curve"]>;
export type LineVariant = NonNullable<VariantProps<typeof line>["variant"]>;

export const LINE_CURVES: Record<LineCurve, CurveFactory> = {
	natural: curveNatural,
	monotone: curveMonotoneX,
	linear: curveLinear,
	step: curveStepAfter
};

export const profitLoss = tv({
	slots: {
		segment:
			"fill-none [stroke-linecap:round] [stroke-linejoin:round] transition-opacity duration-200 ease-[cubic-bezier(0.42,0,0.58,1)]",
		positive: "stroke-chart-positive",
		negative: "stroke-chart-negative"
	},
	variants: {
		encoding: {
			dashed: { negative: "[stroke-dasharray:6_4]" },
			dotted: { negative: "[stroke-dasharray:1_5]" }
		}
	},
	defaultVariants: { encoding: "dashed" }
});

export type ProfitLossEncoding = NonNullable<VariantProps<typeof profitLoss>["encoding"]>;
