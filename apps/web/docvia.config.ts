import { defineConfig } from "@docvia/cli";
import { shiki } from "@docvia/plugin-shiki";
import { createSvelteRenderer } from "@docvia/renderer-svelte/node";
import { z } from "zod";
import { remarkMermaid } from "./src/lib/content/remark-mermaid";

const component = (file: string) => ({
	path: `./src/lib/content/components/${file}.svelte`
});

export default defineConfig({
	sourceDir: "content",
	outDir: ".docvia",
	renderer: createSvelteRenderer(),
	collections: [
		{ name: "blog", sourceDir: "content/blog", baseUrl: "/blog" },
		{ name: "docs", sourceDir: "content/docs", baseUrl: "/docs" }
	],
	components: {
		callout: component("Callout"),
		mermaid: component("Mermaid"),
		figure: component("Figure"),
		stats: component("Stats"),
		takeaways: component("Takeaways"),
		cta: component("Cta")
	},
	// One schema covers both collections, so cross-collection fields are optional.
	frontmatter: z.object({
		date: z.string().optional(),
		updated: z.string().optional(),
		author: z.string().default("Kanak Kholwal"),
		category: z.string().optional(),
		hero: z.string().optional(),
		heroAlt: z.string().optional(),
		heroPrompt: z.string().optional(),
		featured: z.boolean().default(false),
		canonical: z.string().optional(),
		// Answer-first pairs, rendered as a block and emitted as FAQPage JSON-LD.
		faq: z.array(z.object({ q: z.string(), a: z.string() })).default([])
	}),
	markdown: { remarkPlugins: [remarkMermaid] },
	syntax: {
		highlighter: "shiki",
		theme: "github-dark",
		langs: ["latex", "tex", "bash", "json", "ts", "js", "svelte", "yaml", "toml", "diff"]
	},
	plugins: [
		shiki({ theme: "github-dark", langs: ["latex", "tex", "bash", "json", "ts", "yaml", "diff"] })
	],
	theme: { name: "glyphtex", options: {} }
});
