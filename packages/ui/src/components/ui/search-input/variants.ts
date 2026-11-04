import { tv, type VariantProps } from "tailwind-variants";

// The clear button has a reserved slot, so the field never changes width when it appears.
export const searchInput = tv({
	slots: {
		root: "",
		icon: "size-4 text-muted-foreground",
		input:
			"[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
		end: "grid min-w-6 place-items-center [&>*]:col-start-1 [&>*]:row-start-1",
		clear: [
			"grid size-6 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
			"transition-[opacity,scale,filter] duration-(--duration-fast) ease-(--ease-ui-out) active:scale-96 motion-reduce:transition-none",
			"data-[on=false]:pointer-events-none data-[on=false]:scale-80 data-[on=false]:opacity-0 data-[on=false]:blur-[2px] [&_svg]:size-3.5",
		],
		shortcut:
			"pointer-events-none transition-opacity duration-(--duration-fast) data-[on=false]:opacity-0",
	},
	variants: {
		variant: {
			default: {},
			pill: { root: "rounded-full" },
		},
	},
	defaultVariants: { variant: "default" },
});

export type SearchInputVariant = NonNullable<VariantProps<typeof searchInput>["variant"]>;
