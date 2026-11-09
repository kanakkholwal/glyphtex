import { defaultPacks } from "glyphtex-engine";
import { loadManifest, openEngineCache } from "./manifest";
import { loadPackIndex } from "./packs";
import { planUpdate, type UpdatePlan } from "./update-plan";

async function cachedKeys(): Promise<string[]> {
	const cache = await openEngineCache();
	if (!cache) return [];
	try {
		return (await cache.keys()).map((request) => {
			const { pathname, search } = new URL(request.url);
			return pathname + search;
		});
	} catch {
		return [];
	}
}

/**
 * Compares the deployed compiler (manifest + pack index, fetched fresh) with what this
 * device has cached. Null means up to date, never installed, or offline: all of which
 * need no prompt here.
 */
export async function checkEngineUpdate(): Promise<UpdatePlan | null> {
	let manifest: Awaited<ReturnType<typeof loadManifest>>;
	try {
		manifest = await loadManifest();
	} catch {
		return null;
	}
	const index = await loadPackIndex().catch(() => null);
	return planUpdate({
		manifest,
		packs: index?.packs ?? [],
		defaultPackIds: index ? defaultPacks(index).map((p) => p.id) : [],
		cached: await cachedKeys()
	});
}
