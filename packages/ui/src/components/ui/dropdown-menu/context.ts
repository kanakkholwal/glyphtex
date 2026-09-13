import { twMergeConfig } from "@glyphtex/ui/utils";
import { getContext, setContext } from "svelte";
import { tv, type VariantProps } from "tailwind-variants";

const SIZE_KEY = Symbol.for("glyphtex-ui.dropdown-menu.size");

export type DropdownMenuSize = "sm" | "default" | "lg";

/** Call during `<Content>` init; the getter keeps a changing `size` prop reactive. */
export function setDropdownMenuSize(size: () => DropdownMenuSize) {
	setContext(SIZE_KEY, size);
}

export function getDropdownMenuSize(): () => DropdownMenuSize {
	return getContext<(() => DropdownMenuSize) | undefined>(SIZE_KEY) ?? (() => "default");
}

/** Padding / min-width applied to <Content>. */
export const dropdownMenuContentSizeVariants = tv(
	{
		base: "",
		variants: {
			size: {
				sm: "min-w-28 p-0.5 text-xs",
				default: "min-w-32 p-1",
				lg: "min-w-40 p-1.5 text-md"
			}
		},
		defaultVariants: { size: "default" }
	},
	{ twMergeConfig }
);

/** Row sizing for <Item>, <CheckboxItem>, <RadioItem>, <SubTrigger>. `sm` is dense opt-in only. */
export const dropdownMenuItemSizeVariants = tv(
	{
		base: "",
		variants: {
			size: {
				sm: "min-h-7 gap-1.5 px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
				default: "min-h-8 gap-2 px-2 py-1 text-sm [&_svg:not([class*='size-'])]:size-4",
				lg: "min-h-9 gap-2 px-2 py-1.5 text-md [&_svg:not([class*='size-'])]:size-4"
			},
			variant: {
				destructive: "data-[state=on]:bg-destructive/10 [&_[data-state=on]_svg]:text-destructive",
				warning: "data-[state=on]:bg-warning/10 [&_[data-state=on]_svg]:text-warning",
				primary: "data-[state=on]:bg-primary/10 [&_[data-state=on]_svg]:text-primary",
				secondary: "data-[state=on]:bg-muted [&_[data-state=on]_svg]:text-foreground"
			}
		},
		defaultVariants: { size: "default" }
	},
	{ twMergeConfig }
);

/** Shared row chrome: accent highlight, muted icons, disabled by opacity. */
export const DROPDOWN_MENU_ROW =
	"relative flex cursor-default items-center rounded-md outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='text-'])]:text-muted-foreground";

export type DropdownMenuContentSizeVariant = VariantProps<
	typeof dropdownMenuContentSizeVariants
>["size"];
