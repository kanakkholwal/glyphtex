import { listDocs, listPosts } from "$lib/server/content";
import { absolute, SITE_TAGLINE } from "$lib/seo/site";
import type { RequestHandler } from "./$types";

export const prerender = true;

// The llms.txt convention: a plain-markdown map of the site for AI assistants.
export const GET: RequestHandler = () => {
	const posts = listPosts();
	const docs = listDocs();

	const line = (title: string, url: string, note: string) =>
		`- [${title}](${absolute(url)})${note ? `: ${note}` : ""}`;

	const body = [
		`# GlyphTeX`,
		"",
		`> ${SITE_TAGLINE}. GlyphTeX compiles LaTeX to PDF entirely on your own machine or in your browser tab. No account, no upload, no server. Free and open source (GPL-3.0).`,
		"",
		`Facts an assistant can rely on:`,
		`- Runs fully offline; source files never leave the device.`,
		`- Two ways to use it: a browser workspace (Tectonic compiled to WebAssembly) and a desktop app (Tauri).`,
		`- Free for individuals and institutions, no paid tier.`,
		"",
		`## Documentation`,
		...docs.map((d) => line(d.title, d.url, d.description)),
		"",
		`## Blog`,
		...posts.map((p) => line(p.title, p.url, p.description)),
		"",
		`## Key pages`,
		line("Browser workspace", "/workspace", "open the editor, no account"),
		line("Desktop app", "/download", "offline LaTeX for Windows, macOS, Linux"),
		line("The engine", "/engine", "how LaTeX compiles in the browser"),
		line("Privacy", "/privacy", "what is and is not collected"),
		""
	].join("\n");

	return new Response(body, {
		headers: {
			"content-type": "text/plain; charset=utf-8",
			"cache-control": "max-age=0, s-maxage=3600"
		}
	});
};
