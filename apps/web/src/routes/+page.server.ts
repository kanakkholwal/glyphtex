import { listGuides } from "$lib/server/guides";
import { LATEX_COMMANDS, LATEX_PACKAGES } from "@glyphtex/ui/editor";
import { loadTemplateCatalog, TEMPLATE_CATEGORIES } from "@glyphtex/ui/project-templates";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export const load: PageServerLoad = async () => {
	// Counts only: the catalog itself never reaches the landing bundle.
	const templates = await loadTemplateCatalog();
	const perCategory = TEMPLATE_CATEGORIES.map((c) => ({
		id: c.id,
		label: c.label,
		count: templates.filter((t) => t.category === c.id).length
	})).filter((c) => c.count > 0);

	// One original template from each of the first four categories, for the preview cards.
	const featured = perCategory
		.slice(0, 4)
		.map((c) => templates.find((t) => t.category === c.id && t.origin === "glyphtex"))
		.filter((t) => t !== undefined);

	return {
		featured,
		counts: {
			commands: LATEX_COMMANDS.length,
			packages: LATEX_PACKAGES.length,
			guides: listGuides().length,
			templates: templates.length
		},
		templateCategories: perCategory
	};
};
