import type { Guide } from "$lib/landing/guides";
import { listDocs, listPosts } from "./content";

/** Docs then blog posts, as one searchable list. */
export function listGuides(): Guide[] {
	return [
		...listDocs().map((d) => ({
			title: d.title,
			description: d.description,
			href: d.url,
			kind: "docs" as const,
			category: d.category
		})),
		...listPosts().map((p) => ({
			title: p.title,
			description: p.description,
			href: p.url,
			kind: "blog" as const,
			category: p.category
		}))
	];
}
