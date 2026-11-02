import { type ProjectTemplate, TEMPLATE_CATEGORIES } from "./index";

export type TemplateSource = "all" | ProjectTemplate["origin"];
export type TemplateTab = { id: string; label: string; count: number };

const matches = (t: ProjectTemplate, q: string) =>
	!q ||
	t.title.toLowerCase().includes(q) ||
	t.description.toLowerCase().includes(q) ||
	t.author.toLowerCase().includes(q) ||
	t.documentClass.toLowerCase().includes(q);

/** Search, source and category over a template list; the gallery on the site and in the workspace share it. */
export class TemplateFilter {
	query = $state("");
	category = $state("all");
	source = $state<TemplateSource>("all");

	#templates: () => readonly ProjectTemplate[] = () => [];

	constructor(templates: () => readonly ProjectTemplate[]) {
		this.#templates = templates;
	}

	// Originals lead: they are written for this editor.
	#ordered = $derived(
		[...this.#templates()].sort(
			(a, b) => Number(b.origin === "glyphtex") - Number(a.origin === "glyphtex")
		)
	);

	/** Search and source applied; category counts come from here, so a chip never promises hidden results. */
	#narrowed = $derived.by(() => {
		const q = this.query.trim().toLowerCase();
		return this.#ordered.filter(
			(t) => (this.source === "all" || t.origin === this.source) && matches(t, q)
		);
	});

	tabs = $derived.by((): TemplateTab[] => {
		const counts: Record<string, number> = {};
		for (const t of this.#narrowed) counts[t.category] = (counts[t.category] ?? 0) + 1;
		const present = new Set(this.#templates().map((t) => t.category));
		return [
			{ id: "all", label: "All", count: this.#narrowed.length },
			...TEMPLATE_CATEGORIES.filter((c) => present.has(c.id)).map((c) => ({
				id: c.id as string,
				label: c.label,
				count: counts[c.id] ?? 0
			}))
		];
	});

	visible = $derived(
		this.category === "all"
			? this.#narrowed
			: this.#narrowed.filter((t) => t.category === this.category)
	);

	active = $derived(this.query.trim() !== "" || this.category !== "all" || this.source !== "all");

	clear() {
		this.query = "";
		this.category = "all";
		this.source = "all";
	}
}
