import { packagesIn } from "$lib/templates/packages";
import { templateSlug } from "$lib/templates/slug";
import {
	loadTemplateCatalog,
	loadTemplateFiles,
	type ProjectTemplate,
	TEMPLATE_CATEGORIES
} from "@glyphtex/ui/project-templates";

export type TemplateDetail = {
	template: ProjectTemplate;
	slug: string;
	categoryLabel: string;
	source: string;
	packages: string[];
	related: ProjectTemplate[];
};

export const categoryLabel = (id: string): string =>
	TEMPLATE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

/** Every template with the packages it loads. Sources are public, so one build-wide cache is safe. */
let usesCache: Promise<{ template: ProjectTemplate; packages: string[] }[]> | null = null;
export function templatePackageUses() {
	usesCache ??= loadTemplateCatalog().then((catalog) =>
		Promise.all(
			catalog.map(async (template) => {
				const files = await loadTemplateFiles(template.id);
				const source = files.find((f) => f.path === "main.tex")?.text ?? "";
				return { template, packages: packagesIn(source) };
			})
		)
	);
	return usesCache;
}

export async function templateSlugs(): Promise<string[]> {
	return (await loadTemplateCatalog()).map((t) => templateSlug(t.id));
}

export async function templateDetail(slug: string): Promise<TemplateDetail | null> {
	const catalog = await loadTemplateCatalog();
	const template = catalog.find((t) => templateSlug(t.id) === slug);
	if (!template) return null;
	const files = await loadTemplateFiles(template.id);
	const source = files.find((f) => f.path === "main.tex")?.text ?? "";
	// Originals first: they are the pages that can rank, so related links favour them.
	const related = catalog
		.filter((t) => t.category === template.category && t.id !== template.id)
		.sort((a, b) => Number(b.origin === "glyphtex") - Number(a.origin === "glyphtex"))
		.slice(0, 3);
	return {
		template,
		slug,
		categoryLabel: categoryLabel(template.category),
		source,
		packages: packagesIn(source),
		related
	};
}
