import { listDocs, listPosts, listTags } from "$lib/server/content";
import { SITE_URL } from "$lib/seo/site";
import type { RequestHandler } from "./$types";

export const prerender = true;

const STATIC: { path: string; priority: string; freq: string }[] = [
	{ path: "/", priority: "1.0", freq: "weekly" },
	{ path: "/blog", priority: "0.9", freq: "daily" },
	{ path: "/docs", priority: "0.9", freq: "weekly" },
	{ path: "/engine", priority: "0.6", freq: "monthly" },
	{ path: "/download", priority: "0.6", freq: "monthly" },
	{ path: "/about", priority: "0.5", freq: "monthly" },
	{ path: "/privacy", priority: "0.3", freq: "yearly" }
];

const url = (loc: string, lastmod: string, freq: string, priority: string) =>
	`  <url><loc>${SITE_URL}${loc}</loc>` +
	(lastmod ? `<lastmod>${lastmod}</lastmod>` : "") +
	`<changefreq>${freq}</changefreq><priority>${priority}</priority></url>`;

export const GET: RequestHandler = () => {
	const rows = [
		...STATIC.map((s) => url(s.path, "", s.freq, s.priority)),
		...listPosts().map((p) => url(p.url, p.updated ?? p.date, "monthly", "0.8")),
		...listTags().map((t) => url(`/blog/tag/${encodeURIComponent(t.tag)}`, "", "weekly", "0.4")),
		...listDocs().map((d) => url(d.url, d.updated ?? "", "monthly", "0.7"))
	];

	const body =
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;

	return new Response(body, {
		headers: { "content-type": "application/xml", "cache-control": "max-age=0, s-maxage=3600" }
	});
};
