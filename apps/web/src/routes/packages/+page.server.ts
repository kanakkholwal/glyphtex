import { engineCoverage } from "$lib/server/engine-packages";
import { listPackages } from "$lib/server/packages";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export const load: PageServerLoad = async () => {
	const [packages, engine] = await Promise.all([listPackages(), engineCoverage()]);
	return {
		packages,
		groups: engine.groups,
		supportedCount: engine.support.size,
		// Entries, not the Map: the search runs client-side over every file the engine has.
		supported: [...engine.support.entries()]
	};
};
