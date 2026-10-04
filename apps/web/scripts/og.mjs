// Renders the Open Graph cards into static/og before `vite build`, so the Worker never ships a renderer.
// Run: `pnpm --filter @glyphtex/web og` (the build runs it too).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "takumi-js";
import { OG_HEIGHT, OG_WIDTH, ogFile } from "../src/lib/seo/og.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "glyphtex.nexonauts.com";

// Static pages: the heading mirrors each page's hero, the tail is set in muted ink.
const PAGES = [
	{
		path: "/",
		eyebrow: "Free and open source",
		title: "Write LaTeX",
		tail: "on your machine.",
		description:
			"A LaTeX editor that compiles in your browser tab. Offline, no account, nothing uploaded."
	},
	{
		path: "/engine",
		eyebrow: "The engine",
		title: "LaTeX, compiled",
		tail: "in a browser tab.",
		description: "Tectonic built to WebAssembly: what it took and how a compile runs."
	},
	{
		path: "/download",
		eyebrow: "Desktop app",
		title: "The desktop app",
		tail: "is a prototype.",
		description:
			"Early builds for Windows, macOS and Linux. The browser workspace is the maintained option."
	},
	{
		path: "/templates",
		eyebrow: "Templates",
		title: "LaTeX templates",
		tail: "that compile offline.",
		description:
			"Theses, journal articles, CVs, letters, posters and slides, with credited authors."
	},
	{
		path: "/errors",
		eyebrow: "Fix a LaTeX error",
		title: "Stuck on a LaTeX error",
		tail: "today?",
		description: "Plain-language fixes for the errors that stop a build."
	},
	{
		path: "/docs",
		eyebrow: "Documentation",
		title: "LaTeX,",
		tail: "without the guesswork.",
		description: "Guides for writing, compiling and fixing LaTeX documents."
	},
	{
		path: "/blog",
		eyebrow: "Blog",
		title: "The GlyphTeX",
		tail: "blog.",
		description: "Writing about local-first LaTeX, compiled on your own machine."
	},
	{
		path: "/about",
		eyebrow: "About",
		title: "Kanak Kholwal",
		tail: "built GlyphTeX.",
		description: "Local-first writing tools, and the Tectonic WASM engine behind GlyphTeX."
	},
	{
		path: "/privacy",
		eyebrow: "Privacy",
		title: "Privacy.",
		tail: "",
		description: "What this website collects, and what it never collects."
	}
];

/** Reads the flat keys of a markdown frontmatter block: quoted or bare strings and inline arrays. */
function frontmatter(file) {
	const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
	const block = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
	const data = {};
	for (const line of block.split("\n")) {
		const m = line.match(/^([A-Za-z]+):\s*(.*)$/);
		if (!m?.[2]) continue;
		const raw = m[2].trim();
		if (raw.startsWith("[")) {
			data[m[1]] = raw
				.slice(1, -1)
				.split(",")
				.map((s) => s.trim().replace(/^["']|["']$/g, ""))
				.filter(Boolean);
		} else data[m[1]] = raw.replace(/^["']|["']$/g, "");
	}
	return data;
}

const markdownIn = (dir) =>
	readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) return markdownIn(full);
		return /\.mdx?$/.test(name) ? [full] : [];
	});

function contentCards(collection, eyebrow) {
	const dir = join(root, "content", collection);
	return markdownIn(dir).map((file) => {
		const data = frontmatter(file);
		const slug = relative(dir, file)
			.split(sep)
			.join("/")
			.replace(/\.mdx?$/, "");
		return {
			path: `/${collection}/${slug}`,
			eyebrow: data.category || eyebrow,
			title: data.title || slug,
			tail: "",
			description: data.description || "",
			tags: Array.isArray(data.tags) ? data.tags : []
		};
	});
}

const posts = contentCards("blog", "Blog");
const docs = contentCards("docs", "Docs");
const tags = [...new Set(posts.flatMap((p) => p.tags))].map((tag) => ({
	path: `/blog/tag/${tag}`,
	eyebrow: "Topic",
	title: "Articles on",
	tail: `${tag}.`,
	description: `Writing on ${tag} from the GlyphTeX blog.`
}));

const escapeHtml = (s) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clamp = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

const logo = readFileSync(join(root, "src/app.html"), "utf8").match(/d="(M149[^"]+)"/)?.[1];
if (!logo) throw new Error("og: G mark path not found in src/app.html");
const mark = `data:image/svg+xml;utf8,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 312 360"><path fill="#ffffff" d="${logo}"/></svg>`
)}`;

// Hex mirrors the light tokens in packages/ui/src/app.css; an image has no CSS variables.
const C = {
	canvas: "#efeff1",
	card: "#ffffff",
	ink: "#0d0d0e",
	muted: "#6b6b72",
	accent: "#025eb8"
};

function card({ eyebrow, title, tail, description }) {
	const heading = `${escapeHtml(title)}${tail ? ` <span style="color:${C.muted}">${escapeHtml(tail)}</span>` : ""}`;
	const size = title.length + tail.length > 44 ? 60 : 76;
	return `<div style="display:flex;width:100%;height:100%;padding:48px;background:${C.canvas};font-family:Geist">
	<div style="display:flex;flex:1;flex-direction:column;justify-content:space-between;padding:56px 64px;background:${C.card};border-radius:32px;border:1px solid rgba(13,13,14,0.06)">
		<div style="display:flex;align-items:center">
			<div style="display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:${C.ink}">
				<img src="${mark}" width="26" height="30" />
			</div>
			<span style="margin-left:16px;font-size:30px;font-weight:500;color:${C.ink}">GlyphTeX</span>
			<span style="margin-left:auto;font-family:JetBrains Mono;font-size:22px;color:${C.muted}">${SITE}</span>
		</div>
		<div style="display:flex;flex-direction:column">
			<div style="font-family:Geist Pixel;font-size:${size}px;line-height:1.05;color:${C.ink}">${heading}</div>
			<div style="margin-top:24px;font-size:30px;line-height:1.4;color:${C.muted}">${escapeHtml(clamp(description, 110))}</div>
		</div>
		<div style="display:flex;align-items:center;font-family:JetBrains Mono;font-size:22px;color:${C.muted}">
			<div style="width:12px;height:12px;border-radius:6px;background:${C.accent}"></div>
			<span style="margin-left:12px">${escapeHtml(eyebrow)}</span>
		</div>
	</div>
</div>`;
}

const CDN = "https://cdn.jsdelivr.net/npm";
const FONTS = [
	{ name: "Geist", weight: 400, file: "@fontsource/geist@5/files/geist-latin-400-normal.woff" },
	{ name: "Geist", weight: 500, file: "@fontsource/geist@5/files/geist-latin-500-normal.woff" },
	{
		name: "Geist Pixel",
		weight: 400,
		file: "@fontsource/geist-pixel@5/files/geist-pixel-latin-400-normal.woff"
	},
	{
		name: "JetBrains Mono",
		weight: 400,
		file: "@fontsource/jetbrains-mono@5/files/jetbrains-mono-latin-400-normal.woff"
	}
];

const fonts = await Promise.all(
	FONTS.map(async ({ name, weight, file }) => {
		const res = await fetch(`${CDN}/${file}`);
		if (!res.ok) throw new Error(`og: font ${file} returned ${res.status}`);
		return { name, weight, style: "normal", data: await res.arrayBuffer() };
	})
);

const all = [...PAGES, ...posts, ...docs, ...tags];
for (const entry of all) {
	const png = await render(card(entry), {
		width: OG_WIDTH,
		height: OG_HEIGHT,
		fonts,
		format: "png"
	});
	const out = join(root, "static", ogFile(entry.path));
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, png);
}
console.log(`og: wrote ${all.length} cards to static/og`);
