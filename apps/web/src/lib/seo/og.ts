// Plain TS with no aliases: `scripts/og.mjs` imports this file directly under Node.

/** Bump when the card template changes: platforms cache OG images for days, so a new URL is the only refresh. */
export const OG_VERSION = "1";
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Where the build writes a page's card, relative to `static/`. */
export function ogFile(pathname: string): string {
	const clean = decodeURIComponent(pathname).replace(/^\/+|\/+$/g, "");
	return `og/${clean || "home"}.png`;
}

/** Public URL of a page's card, versioned. */
export function ogImageUrl(pathname: string): string {
	return `/${ogFile(pathname)}?v=${OG_VERSION}`;
}
