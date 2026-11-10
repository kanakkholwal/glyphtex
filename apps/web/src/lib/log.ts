import { dev } from "$app/environment";

/** Errors and warnings always log; debug and info are dev-only. */
export const log = {
	debug: (...args: unknown[]) => dev && console.debug("[GlyphTeX]", ...args),
	info: (...args: unknown[]) => dev && console.info("[GlyphTeX]", ...args),
	warn: (scope: string, error?: unknown) => console.warn(`[GlyphTeX] ${scope}`, error),
	error: (scope: string, error?: unknown) => console.error(`[GlyphTeX] ${scope}`, error)
};
