import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Pass to `tv(..., { twMergeConfig })` too, or variants drop role sizes the same way. */
export const twMergeConfig = {
	extend: {
		classGroups: {
			// Without these, tailwind-merge reads `text-body` as a colour and drops it next to `text-foreground`.
			"font-size": [
				{
					text: [
						"md",
						"caption",
						"body",
						"body-lg",
						"body-xl",
						"subheading",
						"heading-sm",
						"heading",
						"heading-lg",
						"display",
						"display-xl"
					]
				}
			]
		}
	}
};

const twMerge = extendTailwindMerge(twMergeConfig);

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export {
	CRAFT_FOCUS_RING,
	CRAFT_FOCUS_RING_INSET,
	CRAFT_OVERLAY_ANIMATION,
	CRAFT_OVERLAY_BACKDROP_ANIMATION,
	CRAFT_OVERLAY_SURFACE,
	CRAFT_SCRIM
} from "./craft-utils";

export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
