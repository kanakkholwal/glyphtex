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

// The downloaded LaTeX compiler (wasm binary + TeX support bundle) lives in its
// OWN cache, keyed WITHOUT the build version — see src/lib/tex/worker.ts, which
// owns it. ~15 MB and expensive to refetch, so a new deploy must never wipe it;
// that's what keeps "the compiler is actually installed" true across updates.
// Entries are keyed by engine content hash, so a genuinely new engine misses
// this cache on its own and the worker evicts the superseded version.
const ENGINE_CACHE = 'glyphx-engine';

// App shell + static assets to precache on install. `/engine/*` is deliberately
// excluded: it is ~15 MB, it is only needed by users who actually compile, and
// the install dialog exists precisely so we ask before downloading it.
// Precaching it here would spend that bandwidth on every first visit and make
// the consent gate a lie.
const PRECACHE = [...build, ...files].filter((p) => !p.startsWith('/engine/'));

/**
 * Open a cache, or null if this browser will not give us one.
 *
 * `caches.open` can reject outright — private windows, blocked site data, a
 * profile under disk pressure. Every use here treats that as "no caching
 * today", never as an error, because a service worker that fails a request when
 * its cache is unavailable takes the whole site down with it: the app shell,
 * every JS module, every worker script.
 */
async function openCache(name: string): Promise<Cache | null> {
	try {
		return await caches.open(name);
	} catch {
		return null;
	}
}

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await openCache(CACHE);
			// Precaching is an offline optimisation, not a precondition for
			// running — a failure here must not stop the worker activating.
			await cache?.addAll(PRECACHE).catch(() => {});
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Drop app-shell caches from previous deployments — but keep the current
			// shell cache AND the persistent engine cache (the installed compiler).
			try {
				for (const key of await caches.keys()) {
					if (key !== CACHE && key !== ENGINE_CACHE) await caches.delete(key);
				}
			} catch {
				/* housekeeping only — never block activation over it */
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

	// Engine artifacts: pass straight through, uncached by us. The TeX worker
	// puts these in ENGINE_CACHE itself, keyed by engine version, so caching them
	// here as well would store the same ~15 MB twice and let the two copies
	// disagree about which engine version is installed.
	if (url.pathname.startsWith('/engine/')) return;

	event.respondWith(
		(async () => {
			const cache = await openCache(CACHE);
			// No cache available: behave as if the service worker weren't here.
			// Anything else fails every request on the page, which is far worse
			// than losing offline support.
			if (!cache) return fetch(request);

			// Precached build assets are immutable (hashed) — serve cache-first.
			if (PRECACHE.includes(url.pathname)) {
				const cached = await cache.match(url.pathname).catch(() => undefined);
				if (cached) return cached;
			}

			// Everything else: network-first, fall back to cache when offline.
			try {
				const response = await fetch(request);
				const isCacheable = response.status === 200 && response.type === 'basic';
				// Not awaited, and never allowed to reject: a full quota must not
				// turn a successful response into a failed request.
				if (isCacheable) void cache.put(request, response.clone()).catch(() => {});
				return response;
			} catch (err) {
				const cached = await cache.match(request).catch(() => undefined);
				if (cached) return cached;
				throw err;
			}
		})()
	);
});
