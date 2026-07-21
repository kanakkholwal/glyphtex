// Loading the engine manifest, online or off.
//
// The manifest names the engine version, which is the key everything else in
// the engine cache is stored under — so it has to be readable offline too, or
// an installed user who opens the app on a plane would be told to install
// again. It is cached alongside the artifacts it describes.

import type { EngineManifest } from './protocol';

export const ENGINE_CACHE = 'glyphx-engine';

const MANIFEST_URL = '/engine/manifest.json';

/**
 * Open the engine cache, or return null if this browser will not give us one.
 *
 * The Cache API is an optimisation here, never a requirement: it is what makes
 * the engine survive a reload, but a compiler that re-downloads every session
 * still compiles. Private-mode windows, blocked site data and headless
 * environments can all make `caches.open` reject outright, and treating that as
 * fatal would take the whole feature down rather than just its persistence.
 */
export async function openEngineCache(): Promise<Cache | null> {
	if (typeof caches === 'undefined') return null;
	try {
		return await caches.open(ENGINE_CACHE);
	} catch {
		return null;
	}
}

/** Narrow the parsed JSON before trusting it (AGENTS.md rule #7). */
function parse(value: unknown): EngineManifest {
	if (
		typeof value !== 'object' ||
		value === null ||
		typeof (value as EngineManifest).version !== 'string' ||
		typeof (value as EngineManifest).files !== 'object'
	) {
		throw new Error('The engine manifest is malformed.');
	}
	return value as EngineManifest;
}

/**
 * Fetch the manifest, preferring the network so a new deploy is picked up
 * promptly, and falling back to the cached copy when offline.
 *
 * The network copy is written back to the cache on every success, so the cached
 * manifest always describes the engine the user most recently could have had.
 */
export async function loadManifest(): Promise<EngineManifest> {
	const cache = await openEngineCache();

	try {
		const response = await fetch(MANIFEST_URL, { cache: 'no-cache' });
		if (!response.ok) throw new Error(`manifest ${response.status}`);
		const manifest = parse(await response.clone().json());
		await cache?.put(MANIFEST_URL, response);
		return manifest;
	} catch (networkError) {
		const cached = await cache?.match(MANIFEST_URL);
		if (cached) return parse(await cached.json());
		throw networkError instanceof Error
			? new Error('The compiler is not available offline yet — connect once to install it.')
			: networkError;
	}
}
