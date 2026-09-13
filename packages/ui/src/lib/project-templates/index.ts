export type TemplateCategory =
	| "academic-journal"
	| "bibliography"
	| "book"
	| "calendar"
	| "cv"
	| "formal-letter"
	| "homework"
	| "newsletter"
	| "poster"
	| "presentation"
	| "thesis";

export type ProjectTemplate = {
	id: string;
	/** "overleaf": taken from the Overleaf gallery under its author's licence. "glyphtex": written for GlyphTeX. */
	origin: "overleaf" | "glyphtex";
	title: string;
	description: string;
	category: TemplateCategory;
	author: string;
	license: string;
	/** Canonical licence text, when the licence has one. */
	licenseUrl?: string;
	/** Gallery page the source was taken from. */
	sourceUrl: string;
	/** As shown on the gallery page, e.g. "3 years ago" at crawl time. */
	updated: string;
	documentClass: string;
	/** Engine package sets the source relies on beyond the core bundle. */
	packs: string[];
	/** Every change made to the original, stated for the licence's attribution terms. */
	changes: string[];
};

export type TemplateFile = { path: string; text: string };

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
	{ id: "academic-journal", label: "Journal articles" },
	{ id: "thesis", label: "Theses" },
	{ id: "presentation", label: "Presentations" },
	{ id: "homework", label: "Assignments" },
	{ id: "cv", label: "CVs and résumés" },
	{ id: "formal-letter", label: "Letters" },
	{ id: "poster", label: "Posters" },
	{ id: "book", label: "Books" },
	{ id: "bibliography", label: "Bibliographies" },
	{ id: "newsletter", label: "Newsletters" },
	{ id: "calendar", label: "Calendars" }
];

/** The catalog is its own chunk: nothing about templates ships until a user opens the gallery. */
export function loadTemplateCatalog(): Promise<ProjectTemplate[]> {
	return import("./catalog").then((m) => m.TEMPLATE_CATALOG);
}

const sources = import.meta.glob<string>("./sources/*.tex", { query: "?raw", import: "default" });

function attribution(t: ProjectTemplate): string {
	const lines = [
		`# ${t.title}`,
		"",
		t.origin === "glyphtex"
			? `This project started from "${t.title}", a template written for GlyphTeX and dedicated to the public domain.`
			: `This project started from "${t.title}" by ${t.author}.`,
		"",
		`- Source: ${t.sourceUrl}`,
		`- Licence: ${t.license}${t.licenseUrl ? ` (${t.licenseUrl})` : ""}`,
		t.origin === "glyphtex"
			? `- Written for GlyphTeX, September 2026`
			: `- Retrieved for GlyphTeX in September 2026`,
		"",
		t.changes.length > 0
			? `Changes made by GlyphTeX:\n\n${t.changes.map((c) => `- ${c}`).join("\n")}`
			: t.origin === "glyphtex"
				? ""
				: "No changes were made to the original source.",
		"",
		t.origin === "glyphtex"
			? "You can use, change and share it without credit."
			: "Keep this file if you share the project: the licence asks that the author is credited.",
		""
	];
	return lines.join("\n");
}

/** Files for a new project: the template source plus its attribution. Sources load on demand. */
export async function loadTemplateFiles(id: string): Promise<TemplateFile[]> {
	const template = (await loadTemplateCatalog()).find((t) => t.id === id);
	const load = sources[`./sources/${id}.tex`];
	if (!template || !load) throw new Error(`Unknown template: ${id}`);
	const text = await load();
	return [
		{ path: "main.tex", text },
		{ path: "TEMPLATE-LICENSE.md", text: attribution(template) }
	];
}
