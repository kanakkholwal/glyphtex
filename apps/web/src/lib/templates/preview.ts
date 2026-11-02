// Plain TS with no aliases: `scripts/template-previews.mjs` imports this file directly under Node.
/** Rendered width in pixels: about 2x a gallery card, so previews stay sharp on dense screens. */
export const PREVIEW_WIDTH = 600;

/** Where a template's page-1 preview lives, relative to `static/`. */
export const previewFile = (slug: string): string => `template-previews/${slug}.webp`;
