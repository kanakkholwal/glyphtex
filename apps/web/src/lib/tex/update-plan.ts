import type { EngineManifest } from "./protocol";

export type PackRef = { id: string; label: string; hash: string; bytes: number };

export type UpdatePlan = {
	/** Whether the engine and TeX bundle changed, not just packs. */
	coreChanged: boolean;
	coreBytes: number;
	/** Packs this device uses (or ships by default) whose cached copy is missing or older. */
	packs: PackRef[];
	totalBytes: number;
	/** Identifies this exact update, so "Later" is remembered per update, not forever. */
	signature: string;
};

const engineKey = (name: string, version: string) => `/engine/${name}?v=${version}`;
const packKey = (id: string, hash: string) => `/engine/packs/pack-${id}.tar.gz?v=${hash}`;
const ENGINE_FILE = /^\/engine\/[^/]+\.(wasm|tar\.gz)\?/;
const PACK_FILE = /^\/engine\/packs\/pack-(.+)\.tar\.gz\?/;

/**
 * What a device has to download to match the deployed compiler.
 * `cached` holds the engine cache's request URLs as `pathname + search`.
 * Returns null when nothing is missing, and also when no engine was ever installed:
 * that is the first-run install, not an update.
 */
export function planUpdate(input: {
	manifest: EngineManifest;
	packs: readonly PackRef[];
	/** Packs the engine loads by default, which a device should hold. */
	defaultPackIds: readonly string[];
	cached: readonly string[];
}): UpdatePlan | null {
	const { manifest, packs, defaultPackIds, cached } = input;
	const have = new Set(cached);
	if (!cached.some((key) => ENGINE_FILE.test(key))) return null;

	const names = Object.keys(manifest.files);
	const coreChanged = !names.every((name) => have.has(engineKey(name, manifest.version)));
	const coreBytes = coreChanged
		? names.reduce((sum, n) => sum + (manifest.files[n]?.bytes ?? 0), 0)
		: 0;

	const installed = new Set(
		cached.map((key) => PACK_FILE.exec(key)?.[1]).filter(Boolean) as string[]
	);
	const wanted = new Set([...defaultPackIds, ...installed]);
	const stale = packs.filter((p) => wanted.has(p.id) && !have.has(packKey(p.id, p.hash)));

	if (!coreChanged && stale.length === 0) return null;
	const packBytes = stale.reduce((sum, p) => sum + p.bytes, 0);
	return {
		coreChanged,
		coreBytes,
		packs: stale,
		totalBytes: coreBytes + packBytes,
		signature: `${coreChanged ? manifest.version : "-"}|${stale.map((p) => `${p.id}@${p.hash}`).join(",")}`
	};
}
