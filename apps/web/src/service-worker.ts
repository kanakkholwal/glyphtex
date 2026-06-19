/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// SvelteKit's built-in service worker. SvelteKit bundles this file and exposes
// `$service-worker` with the precise list of build assets + a content hash.
// This is what powers GlyphX's "open the browser, works offline" promise — no
// Workbox, no generated *.sw.js, just the framework primitive.

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// App-shell cache — keyed by build version, replaced on every deploy.
const CACHE = `glyphx-cache-${version}`;

// The downloaded LaTeX compiler (TeX Live on-demand packages + the format file)
// lives in its OWN cache, keyed WITHOUT the build version. These files are
// immutable per URL path and expensive to refetch (the format alone is ~10 MB),
// so a new deploy must never wipe them — that's what keeps "the compiler is
// actually installed" true across updates. It's populated on demand (and by the
// first-run install dialog) and only ever grows.
const TEXLIVE_CACHE = 'glyphx-texlive';

// App shell + static assets to precache on install (includes /swiftlatex/* —
// the engine WASM + JS, so the engine itself is available offline after the
// first visit). The vendored TeX base bundle under /texmirror/* is deliberately
// excluded — it's the `/texlive` route's server-side source (served to the
// client as /texlive/* and cached there), so precaching it would force a large
// download on every first visit for users who may never compile.
const PRECACHE = [...build, ...files].filter((p) => !p.startsWith('/texmirror/'));

/**
 * Whether a request targets the TeX Live on-demand server. The engine fetches
 * `<endpoint>pdftex/<fmt-int>/<file>` and `<endpoint>pdftex/pk/<dpi>/<file>`
 * regardless of which endpoint (self-hosted or public) it settled on, so we key
 * off the `/pdftex/` path rather than a fixed host.
 */
function isTexlive(url: URL): boolean {
	return url.pathname.includes('/pdftex/');
}

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(PRECACHE);
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Drop app-shell caches from previous deployments — but keep the current
			// shell cache AND the persistent TeX Live cache (the installed compiler).
			for (const key of await caches.keys()) {
				if (key !== CACHE && key !== TEXLIVE_CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (!url.protocol.startsWith('http')) return;

	// TeX Live packages / format: immutable per path → cache-first in the
	// persistent cache, so once downloaded the compiler keeps working offline and
	// across deploys. (Engine worker fetches are same-origin-controlled, so the
	// SW intercepts them too.)
	if (isTexlive(url)) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(TEXLIVE_CACHE);
				const cached = await cache.match(request);
				if (cached) return cached;
				try {
					const response = await fetch(request);
					// Only cache real hits — never a 404 (a missing-package probe must
					// not be remembered as a permanent negative).
					if (response.ok) cache.put(request, response.clone());
					return response;
				} catch (err) {
					const fallback = await cache.match(request);
					if (fallback) return fallback;
					throw err;
				}
			})()
		);
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// Precached build assets are immutable (hashed) — serve cache-first.
			if (PRECACHE.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			// Everything else: network-first, fall back to cache when offline.
			try {
				const response = await fetch(request);
				const isCacheable = response.status === 200 && response.type === 'basic';
				if (isCacheable) cache.put(request, response.clone());
				return response;
			} catch (err) {
				const cached = await cache.match(request);
				if (cached) return cached;
				throw err;
			}
		})()
	);
});
