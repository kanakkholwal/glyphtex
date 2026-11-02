import { asset } from "$app/paths";
import { previewFile } from "./preview";
import sizes from "./previews.json";
import { templateSlug } from "./slug";

export { templatePath, templateSlug } from "./slug";

export type TemplatePreview = { src: string; width: number; height: number };

const known = sizes as Record<string, { width: number; height: number } | undefined>;

/** The prerendered page image from `scripts/template-previews.mjs`, or null before it has run. */
export function templatePreview(id: string): TemplatePreview | null {
	const slug = templateSlug(id);
	const size = known[slug];
	return size ? { src: asset(`/${previewFile(slug)}`), ...size } : null;
}
