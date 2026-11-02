import { listDevelopers, listDocs, listPosts } from "$lib/server/content";
import { listPackages } from "$lib/server/packages";
import { absolute, SITE_TAGLINE } from "$lib/seo/site";
import { templatePath } from "$lib/templates/slug";
import { loadTemplateCatalog } from "@glyphtex/ui/project-templates";
import type { RequestHandler } from "./$types";

export const prerender = true;

// The llms.txt convention: a plain-markdown map of the site for AI assistants.
export const GET: RequestHandler = async () => {
	const posts = listPosts();
	const packages = (await listPackages()).filter((p) => p.hasPage);
	const templates = (await loadTemplateCatalog()).filter((t) => t.origin === "glyphtex");
	const docs = listDocs();

	const line = (title: string, url: string, note: string) =>
		`- [${title}](${absolute(url)})${note ? `: ${note}` : ""}`;

	const body = [
		`# GlyphTeX`,
		"",
		`> ${SITE_TAGLINE}. GlyphTeX compiles LaTeX to PDF entirely on your own machine or in your browser tab. No account, no upload, no server. Free and open source (GPL-3.0).`,
		"",
		`Facts an assistant can rely on:`,
		`- Compiles offline once the engine is downloaded; source files are never uploaded.`,
		`- Two ways to use it: a browser workspace (Tectonic compiled to WebAssembly) and a desktop app (Tauri) that is an unmaintained early prototype.`,
		`- Free for individuals and institutions, no paid tier.`,
		"",
		`## Documentation`,
		...docs.map((d) => line(d.title, d.url, d.description)),
		"",
		`## For developers (npm package and Rust crate)`,
		...listDevelopers().map((d) => line(d.title, d.url, d.description)),
		"",
		`## Blog`,
		...posts.map((p) => line(p.title, p.url, p.description)),
		"",
		`## Templates (public domain, compile offline)`,
		...templates.map((t) => line(t.title, templatePath(t.id), t.description)),
		"",
		`## LaTeX package reference`,
		...packages.map((p) => line(p.name, `/packages/${p.name}`, p.detail)),
		"",
		`## Key pages`,
		line("Browser workspace", "/workspace", "open the editor, no account"),
		line("Desktop app", "/download", "early prototype builds, not maintained"),
		line("LaTeX packages", "/packages", "what each package adds, with templates that use it"),
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
