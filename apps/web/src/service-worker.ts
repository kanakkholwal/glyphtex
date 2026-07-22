/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// App-shell cache — keyed by build version, replaced on every deploy.
const CACHE = `glyphtex-cache-${version}`;

// Owned by src/lib/tex/worker.ts and deliberately not build-versioned: a deploy
// must never wipe the ~15 MB compiler. Entries are keyed by engine content hash.
const ENGINE_CACHE = 'glyphtex-engine';

// `/engine/*` is excluded: ~15 MB the install dialog asks consent for first.
const PRECACHE = [...build, ...files].filter((p) => !p.startsWith('/engine/'));

// `caches.open` can reject (private windows, blocked site data); callers must
// degrade to "no caching today" rather than failing every request on the page.
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
			// Precaching is an optimisation; a failure must not stop activation.
			await cache?.addAll(PRECACHE).catch(() => {});
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Drop old app-shell caches, keeping the current one and the engine cache.
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

	// Engine artifacts pass through: the TeX worker owns ENGINE_CACHE, and caching
	// them here too would duplicate ~15 MB and let the copies disagree on version.
	if (url.pathname.startsWith('/engine/')) return;

	event.respondWith(
		(async () => {
			const cache = await openCache(CACHE);
			// No cache available: behave as if the service worker weren't here.
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
				// Never awaited or rejected: a full quota must not fail the request.
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
