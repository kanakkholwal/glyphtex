import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
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

			// Deployed to Cloudflare Workers (static assets + SSR worker). The
			// build output lands in .svelte-kit/cloudflare; wrangler.jsonc points
			// the deploy at it. See .github/workflows/deploy-web.yml.
			adapter: adapter(),

			// Registered by hand instead (see src/routes/+layout.svelte), so it can
			// be kept out of development. A service worker in dev intercepts Vite's
			// module and HMR traffic for no benefit — offline support is a
			// production feature — and a stale registration then serves yesterday's
			// modules until it is manually cleared.
			serviceWorker: { register: false }
		})
	]
});
