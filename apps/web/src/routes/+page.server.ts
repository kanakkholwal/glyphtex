import { listGuides } from "$lib/server/guides";
import { LATEX_COMMANDS, LATEX_PACKAGES } from "@glyphtex/ui/editor";
import { loadTemplateCatalog, TEMPLATE_CATEGORIES } from "@glyphtex/ui/project-templates";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	// Counts only: the catalog itself never reaches the landing bundle.
	const templates = await loadTemplateCatalog();
	const perCategory = TEMPLATE_CATEGORIES.map((c) => ({
		id: c.id,
		label: c.label,
		count: templates.filter((t) => t.category === c.id).length
	})).filter((c) => c.count > 0);

	return {
		counts: {
			commands: LATEX_COMMANDS.length,
			packages: LATEX_PACKAGES.length,
			guides: listGuides().length,
			templates: templates.length
		},
		templateCategories: perCategory
	};
};
