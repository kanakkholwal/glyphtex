import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, searchForWorkspaceRoot } from "vite";

// Tauri exposes its dev host through this env var when targeting devices.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes("node_modules") ? undefined : true
			},
			// SPA mode: a single index.html fallback served by the Tauri WebView.
			adapter: adapter({ fallback: "index.html" })
		})
	],

	// --- Tauri integration ---------------------------------------------------
	clearScreen: false,
	server: {
		// Fixed port so Tauri's devUrl stays stable.
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: "ws",
					host,
					port: 1421
				}
			: undefined,
		watch: {
			// The Rust side is rebuilt by cargo, not vite.
			ignored: ["**/src-tauri/**"]
		},
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
		// lazy import re-runs the optimizer and 504s every in-flight monaco chunk.
		include: ["pdfjs-dist", "pdfjs-dist/web/pdf_viewer.mjs"]
	},
	build: {
		// Tauri ships a modern WebView; no need to down-level.
		target: "esnext"
	}
});
