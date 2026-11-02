import bundleManifest from "glyphtex-engine/bundle-manifest.json";
import packsConfig from "glyphtex-engine/packs.config.json";

export type PackageSupport = { kind: "core" } | { kind: "pack"; packId: string; packLabel: string };

export type SupportedGroup = {
	id: string;
	label: string;
	description?: string;
	kind: PackageSupport["kind"];
	packages: string[];
};

export type EngineCoverage = {
	/** Curated headline groups: what the page shows first. */
	groups: SupportedGroup[];
	/** Every `.sty`/`.cls` the engine can load, by name. */
	support: Map<string, PackageSupport>;
};

type ManifestGroup = { id: string; label: string; files?: string[] };
type PackConfig = { id: string; label: string; description?: string; packages?: string[] };
type PackIndex = { packs?: { id: string; label: string }[]; provides?: Record<string, string> };

const texName = (file: string) => file.match(/^(?:.*\/)?([^/]+)\.(sty|cls)$/)?.[1] ?? null;

function headlineGroups(): SupportedGroup[] {
	const core = ((bundleManifest as { groups?: ManifestGroup[] }).groups ?? []).map((g) => ({
		id: g.id,
		label: g.label,
		kind: "core" as const,
		packages: [...new Set((g.files ?? []).map(texName).filter((n): n is string => !!n))]
	}));
	const packs = ((packsConfig as { packs?: PackConfig[] }).packs ?? []).map((p) => ({
		id: p.id,
		label: p.label,
		description: p.description,
		kind: "pack" as const,
		packages: [...new Set(p.packages ?? [])]
	}));
	return [...core, ...packs].filter((g) => g.packages.length > 0);
}

let cache: Promise<EngineCoverage> | null = null;

/**
 * Reads the staged engine (static/engine) at prerender. Public build output, so one cache is safe.
 * Node-only and never reached at runtime: every route that calls it is prerendered.
 */
export function engineCoverage(): Promise<EngineCoverage> {
	cache ??= load();
	return cache;
}

async function load(): Promise<EngineCoverage> {
	const [{ existsSync, readFileSync }, { gunzipSync }, { join }, { untar }] = await Promise.all([
		import("node:fs"),
		import("node:zlib"),
		import("node:path"),
		import("$lib/tex/tar")
	]);
	const dir = join(process.cwd(), "static/engine");
	const bundle = join(dir, "tectonic-bundle.tar.gz");
	if (!existsSync(bundle)) {
		throw new Error(
			"engine-packages: no staged engine; run `pnpm --filter @glyphtex/web sync:engine`"
		);
	}

	const support = new Map<string, PackageSupport>();
	for (const file of untar(gunzipSync(readFileSync(bundle))).keys()) {
		const name = texName(file);
		if (name) support.set(name, { kind: "core" });
	}

	const indexPath = join(dir, "packs/packs-index.json");
	const index: PackIndex = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : {};
	const labels = new Map((index.packs ?? []).map((p) => [p.id, p.label]));
	for (const [file, packId] of Object.entries(index.provides ?? {})) {
		const name = texName(file);
		if (!name || support.has(name)) continue;
		support.set(name, { kind: "pack", packId, packLabel: labels.get(packId) ?? packId });
	}

	return { groups: headlineGroups(), support };
}
