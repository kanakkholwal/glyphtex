import type { Snippet } from "svelte";

export type MegaNavLink = { label: string; href: string; external?: boolean };

export type MegaMenuItem = {
	label: string;
	href: string;
	description?: string;
	icon?: Snippet;
	external?: boolean;
};

export type MegaMenuGroup = {
	label: string;
	href: string;
	items: MegaMenuItem[];
	/** Secondary links under the items, one line each in columns. */
	more?: { heading?: string; links: MegaNavLink[] };
	footer?: { label: string; href: string; hint?: string };
};
