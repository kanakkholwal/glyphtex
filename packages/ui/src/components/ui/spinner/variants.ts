import { tv, type VariantProps } from "tailwind-variants";

export const spinnerIcon = tv({
	base: "spinner",
	variants: {
		size: {
			sm: "size-3.5",
			md: "size-5",
			lg: "size-8",
			xl: "size-12"
		}
	},
	defaultVariants: { size: "md" }
});

export type SpinnerSize = NonNullable<VariantProps<typeof spinnerIcon>["size"]>;
