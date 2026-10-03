import { listPosts } from "$lib/server/content";
import type { RequestHandler } from "./$types";

export const prerender = true;

export function entries() {
	return listPosts().map((post) => ({ slug: post.slug }));
}

const esc = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// No SVG auto-wrap, so the title is split by a rough char budget for a 1200px canvas at this weight.
function wrapTitle(title: string, maxChars = 20, maxLines = 3): string[] {
	const words = title.split(/\s+/);
	const lines: string[] = [];
	let line = "";
	for (const word of words) {
		const next = line ? `${line} ${word}` : word;
		if (next.length > maxChars && line) {
			lines.push(line);
			line = word;
		} else {
			line = next;
		}
		if (lines.length === maxLines - 1) break;
	}
	if (line) lines.push(line);
	const last = lines[maxLines - 1];
	if (lines.length === maxLines && last && last.length > maxChars) {
		lines[maxLines - 1] = `${last.slice(0, maxChars - 1)}…`;
	}
	return lines;
}

export const GET: RequestHandler = ({ params }) => {
	const post = listPosts().find((p) => p.slug === params.slug);
	if (!post) return new Response("Not found", { status: 404 });

	const lines = wrapTitle(post.title);
	const lineHeight = 86;
	const startY = 300 - ((lines.length - 1) * lineHeight) / 2;
	const titleSvg = lines
		.map(
			(line, i) =>
				`<text x="80" y="${startY + i * lineHeight}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="68" font-weight="700" fill="#1a1a1a">${esc(line)}</text>`
		)
		.join("\n  ");

	const body = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect x="0" y="0" width="1200" height="12" fill="#292929"/>
  <text x="80" y="140" font-family="ui-sans-serif, system-ui, sans-serif" font-size="30" font-weight="600" fill="#5d5d5d">${esc(post.category)}</text>
  ${titleSvg}
  <text x="80" y="560" font-family="ui-sans-serif, system-ui, sans-serif" font-size="26" font-weight="700" fill="#292929">GlyphTeX</text>
  <text x="212" y="560" font-family="ui-sans-serif, system-ui, sans-serif" font-size="26" fill="#9e9e9e">· A local-first LaTeX editor</text>
</svg>
`;

	return new Response(body, {
		headers: {
			"content-type": "image/svg+xml",
			"cache-control": "public, max-age=31536000, immutable"
		}
	});
};
