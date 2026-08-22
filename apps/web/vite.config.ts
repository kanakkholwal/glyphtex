import { docvia } from "@docvia/plugin-vite";
import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import docviaConfig from "./docvia.config";

export default defineConfig({
	plugins: [
		tailwindcss(),
		docvia(docviaConfig),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes("node_modules") ? undefined : true
			},

			adapter: adapter()
		})
	],

	server: {
		fs: {
			// SvelteKit replaces Vite's workspace-root default with its own narrow list
			// (src, .svelte-kit, node_modules), and `@glyphtex/ui` is a symlink into
			// `packages/ui`: Vite resolves the real path, finds it outside every entry,
			// and 403s it. Dev only.
			allow: [searchForWorkspaceRoot(process.cwd())]
		}
	},

	optimizeDeps: {
		// Discovered only when the preview pane mounts; without this the first
		// lazy import re-runs the optimizer and 504s every chunk already loaded.
		include: ["pdfjs-dist", "pdfjs-dist/web/pdf_viewer.mjs"]
	},

	ssr: {
		// The generated `virtual:docvia/source` module imports `@docvia/source`, a
		// transitive dep. Bundle it so prerender and the Cloudflare worker resolve
		// it without a runtime node_modules lookup.
		noExternal: ["@docvia/source"]
	}
});
