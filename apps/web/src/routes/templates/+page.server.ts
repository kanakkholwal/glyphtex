import { loadTemplateCatalog } from "@glyphtex/ui/project-templates";
import type { PageServerLoad } from "./$types";

export const prerender = true;

// Metadata only: sources stay in their own chunks and load when a template is used.
export const load: PageServerLoad = async () => ({ templates: await loadTemplateCatalog() });
