// Plain TS with no aliases: `scripts/og.mjs` imports this file directly under Node.

/** Public URL slug: GlyphTeX originals drop their `-gtx` id suffix. */
export const templateSlug = (id: string): string => id.replace(/-gtx$/, "");

/** Page path of a template, e.g. `/templates/academic-cv`. */
export const templatePath = (id: string): string => `/templates/${templateSlug(id)}`;
