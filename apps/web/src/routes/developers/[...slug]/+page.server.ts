import { developers, faqOf, groupDevelopers } from "$lib/server/content";
import { error } from "@sveltejs/kit";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () =>
	developers.getPages().map((entry) => ({ slug: entry.slugs.join("/") }));

export const load: PageServerLoad = async ({ params }) => {
	const segments = params.slug.split("/").filter(Boolean);
	const doc = await developers.getPage(segments);
	if (!doc) throw error(404, "Page not found");

	const data = (doc.data ?? {}) as Record<string, unknown>;
	return {
		content: doc.content,
		headings: doc.headings ?? [],
		faq: faqOf(data),
		groups: groupDevelopers(),
		meta: {
			slug: segments.join("/"),
			url: doc.url,
			title: String(data.title ?? segments.join("/")),
			description: String(data.description ?? ""),
			category: String(data.category ?? "Developers"),
			updated: data.updated ? String(data.updated) : undefined
		}
	};
};
