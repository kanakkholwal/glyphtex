import { blog, faqOf, readingMinutes, relatedPosts } from "$lib/server/content";
import { error } from "@sveltejs/kit";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () =>
	blog.getPages().map((entry) => ({ slug: entry.slugs.join("/") }));

export const load: PageServerLoad = async ({ params }) => {
	const segments = params.slug.split("/").filter(Boolean);
	const post = await blog.getPage(segments);
	if (!post) throw error(404, "Article not found");

	const data = (post.data ?? {}) as Record<string, unknown>;
	return {
		content: post.content,
		headings: post.headings ?? [],
		faq: faqOf(data),
		readingMinutes: readingMinutes(post.content),
		meta: {
			slug: segments.join("/"),
			url: post.url,
			title: String(data.title ?? segments.join("/")),
			description: String(data.description ?? ""),
			tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
			category: String(data.category ?? "Article"),
			date: String(data.date ?? ""),
			updated: data.updated ? String(data.updated) : undefined,
			hero: data.hero ? String(data.hero) : undefined,
			heroAlt: data.heroAlt ? String(data.heroAlt) : undefined
		},
		related: relatedPosts(segments.join("/"))
	};
};
