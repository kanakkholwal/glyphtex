import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter()
		})
	],

	optimizeDeps: {
		// Discovered only when the preview pane mounts; without this the first
		// lazy import re-runs the optimizer and 504s every in-flight monaco chunk.
		include: ['pdfjs-dist', 'pdfjs-dist/web/pdf_viewer.mjs']
	}
});
