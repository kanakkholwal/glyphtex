import { listPosts } from "$lib/server/content";
import { absolute, AUTHOR, SITE_NAME, SITE_URL } from "$lib/seo/site";
import type { RequestHandler } from "./$types";

export const prerender = true;

const esc = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const GET: RequestHandler = () => {
	const posts = listPosts().slice(0, 30);
	const items = posts
		.map((post) => {
			const link = absolute(post.url);
			const pubDate = post.date ? new Date(`${post.date}T00:00:00Z`).toUTCString() : "";
			return (
				`    <item>\n` +
				`      <title>${esc(post.title)}</title>\n` +
				`      <link>${link}</link>\n` +
				`      <guid isPermaLink="true">${link}</guid>\n` +
				`      <description>${esc(post.description)}</description>\n` +
				`      <dc:creator>${esc(AUTHOR.name)}</dc:creator>\n` +
				(pubDate ? `      <pubDate>${pubDate}</pubDate>\n` : "") +
				post.tags.map((tag) => `      <category>${esc(tag)}</category>`).join("\n") +
				`\n    </item>`
			);
		})
		.join("\n");

	const body =
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
		`  <channel>\n` +
		`    <title>${SITE_NAME} Blog</title>\n` +
		`    <link>${SITE_URL}/blog</link>\n` +
		`    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />\n` +
		`    <description>Local-first LaTeX: guides, comparisons, and engineering notes.</description>\n` +
		`    <language>en-GB</language>\n${items}\n  </channel>\n</rss>\n`;

	return new Response(body, {
		headers: {
			"content-type": "application/rss+xml",
			"cache-control": "max-age=0, s-maxage=3600"
		}
	});
};
