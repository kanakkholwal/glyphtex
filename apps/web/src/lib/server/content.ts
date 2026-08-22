import { dev } from "$app/environment";
import { blog, docs } from "virtual:docvia/source";

export type FaqItem = { q: string; a: string };

export type PostMeta = {
	slug: string;
	url: string;
	title: string;
	description: string;
	tags: string[];
	category: string;
	date: string;
	updated?: string;
	hero?: string;
	heroAlt?: string;
	featured: boolean;
	readingMinutes: number;
};

export type DocMeta = {
	slug: string;
	url: string;
	title: string;
	description: string;
	category: string;
	order: number;
	updated?: string;
};

type Frontmatter = Record<string, unknown>;

const str = (data: Frontmatter, key: string, fallback = ""): string => {
	const value = data[key];
	return typeof value === "string" ? value : fallback;
};

const strList = (data: Frontmatter, key: string): string[] => {
	const value = data[key];
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
};

export const faqOf = (data: Frontmatter): FaqItem[] => {
	const value = data.faq;
	if (!Array.isArray(value)) return [];
	return value.filter(
		(item): item is FaqItem => !!item && typeof item === "object" && "q" in item && "a" in item
	);
};

/** Walks a rendered node tree and totals its visible text. */
function wordCount(node: unknown): number {
	if (!node) return 0;
	if (Array.isArray(node)) return node.reduce<number>((sum, n) => sum + wordCount(n), 0);
	if (typeof node !== "object") return 0;
	const n = node as { kind?: string; value?: unknown; children?: unknown };
	if (n.kind === "text" && typeof n.value === "string") {
		return n.value.trim() ? n.value.trim().split(/\s+/).length : 0;
	}
	return wordCount(n.children);
}

export const readingMinutes = (content: unknown): number =>
	Math.max(1, Math.round(wordCount(content) / 225));

const visible = (data: Frontmatter): boolean => dev || data.draft !== true;

function toPost(entry: { slugs: string[]; url: string; data: unknown }): PostMeta {
	const data = (entry.data ?? {}) as Frontmatter;
	return {
		slug: entry.slugs.join("/"),
		url: entry.url,
		title: str(data, "title", entry.slugs.join("/")),
		description: str(data, "description"),
		tags: strList(data, "tags"),
		category: str(data, "category", "Article"),
		date: str(data, "date"),
		updated: str(data, "updated") || undefined,
		hero: str(data, "hero") || undefined,
		heroAlt: str(data, "heroAlt") || undefined,
		featured: data.featured === true,
		readingMinutes: typeof data.readingMinutes === "number" ? data.readingMinutes : 0
	};
}

/** Newest first. Posts with no date sort last rather than disappearing. */
export function listPosts(): PostMeta[] {
	return blog
		.getPages()
		.filter((entry) => visible((entry.data ?? {}) as Frontmatter))
		.map(toPost)
		.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function listTags(): { tag: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const post of listPosts()) {
		for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function listDocs(): DocMeta[] {
	return docs
		.getPages()
		.filter((entry) => visible((entry.data ?? {}) as Frontmatter))
		.map((entry) => {
			const data = (entry.data ?? {}) as Frontmatter;
			return {
				slug: entry.slugs.join("/"),
				url: entry.url,
				title: str(data, "title", entry.slugs.join("/")),
				description: str(data, "description"),
				category: str(data, "category", "Guides"),
				order: typeof data.order === "number" ? data.order : 99,
				updated: str(data, "updated") || undefined
			};
		})
		.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function groupDocs(): { category: string; items: DocMeta[] }[] {
	const groups = new Map<string, DocMeta[]>();
	for (const doc of listDocs()) {
		const bucket = groups.get(doc.category) ?? [];
		bucket.push(doc);
		groups.set(doc.category, bucket);
	}
	return [...groups.entries()].map(([category, items]) => ({ category, items }));
}

/**
 * Posts sharing the most tags with `slug`, newest first as the tie-break. Keeps
 * every article one hop from its cluster, which is what the internal linking
 * strategy depends on.
 */
export function relatedPosts(slug: string, limit = 3): PostMeta[] {
	const all = listPosts();
	const current = all.find((post) => post.slug === slug);
	if (!current) return all.slice(0, limit);
	const tags = new Set(current.tags);
	return all
		.filter((post) => post.slug !== slug)
		.map((post) => ({ post, overlap: post.tags.filter((tag) => tags.has(tag)).length }))
		.sort((a, b) => b.overlap - a.overlap || (b.post.date || "").localeCompare(a.post.date || ""))
		.slice(0, limit)
		.map((entry) => entry.post);
}

export { blog, docs };
