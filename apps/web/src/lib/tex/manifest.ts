import type { EngineManifest } from './protocol';

export const ENGINE_CACHE = 'glyphtex-engine';

const MANIFEST_URL = '/engine/manifest.json';

/**
 * Open the engine cache, or null if unavailable (private mode, blocked storage).
 * Caching is an optimisation only — callers must work without it.
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
 * Fetch the manifest network-first, falling back to the cached copy offline.
 * It must stay cached: its version is the key the engine artifacts live under.
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
