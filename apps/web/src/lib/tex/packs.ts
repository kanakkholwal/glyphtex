import { parsePackIndex, type InstalledPack, type PackIndex } from 'glyphtex-engine';
import { openEngineCache } from './manifest';

const INDEX_URL = '/engine/packs/packs-index.json';

/** Cache key for a pack, keyed on content hash so a rebuilt pack misses. */
function packUrl(id: string, hash: string): string {
	return `/engine/packs/pack-${id}.tar.gz?v=${hash}`;
}

// Returns null when there is no index: a deployment without packs must still
// compile, rather than the editor failing over a feature it does not ship.
export async function loadPackIndex(): Promise<PackIndex | null> {
	const cache = await openEngineCache();

	try {
		const response = await fetch(INDEX_URL, { cache: 'no-cache' });
		if (!response.ok) throw new Error(`pack index ${response.status}`);
		const index = parsePackIndex(await response.clone().json());
		await cache?.put(INDEX_URL, response).catch(() => {});
		return index;
	} catch {
		const cached = await cache?.match(INDEX_URL);
		if (!cached) return null;
		try {
			return parsePackIndex(await cached.json());
		} catch {
			// A cached index we cannot parse is worse than none: it would silently
			// under-report what is installable.
			return null;
		}
	}
}

/** Which packs are present on this device, according to the cache itself. */
export async function installedPacks(index: PackIndex): Promise<InstalledPack[]> {
	const cache = await openEngineCache();
	if (!cache) return [];

	const found = await Promise.all(
		index.packs.map(async (pack) =>
			(await cache.match(packUrl(pack.id, pack.hash))) ? { id: pack.id, hash: pack.hash } : null
		)
	);
	return found.filter((p): p is InstalledPack => p !== null);
}

/** Returns the bytes so a caller can load them without a second fetch. */
export async function fetchPack(index: PackIndex, id: string): Promise<Uint8Array> {
	const pack = index.packs.find((p) => p.id === id);
	if (!pack) throw new Error(`Unknown package set "${id}".`);

	const key = packUrl(pack.id, pack.hash);
	const cache = await openEngineCache();

	const cached = await cache?.match(key);
	if (cached) return new Uint8Array(await cached.arrayBuffer());

	let response: Response;
	try {
		response = await fetch(key);
	} catch (cause) {
		throw new Error(
			`Could not download ${pack.label}: ${cause instanceof Error ? cause.message : String(cause)}`,
			{ cause }
		);
	}
	if (!response.ok) {
		throw new Error(
			`Could not download ${pack.label} (${response.status} ${response.statusText}).`
		);
	}

	const bytes = new Uint8Array(await response.arrayBuffer());
	// Best-effort: a quota rejection must not discard a download that worked.
	await cache?.put(key, new Response(bytes)).catch(() => {});
	return bytes;
}

/** Remove a pack's cached download. Its files stay in any running engine. */
export async function removePack(index: PackIndex, id: string): Promise<void> {
	const pack = index.packs.find((p) => p.id === id);
	if (!pack) return;
	const cache = await openEngineCache();
	await cache?.delete(packUrl(pack.id, pack.hash));
}
