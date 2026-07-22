// See PACKS.md for the design. This module is the contract: the build script
// writes JSON conforming to it, the runtime narrows before trusting it.

export type PackDefinition = {
	/** Stable id, also the tarball basename: `pack-<id>.tar.gz`. */
	id: string;
	label: string;
	description: string;
	/** TeX Live package names, for display and traceability. */
	packages: string[];
	/** Packs owning files this one needs; shared files are delegated, not copied. */
	requires: string[];
	/** Skip in the first-run install. For future font packs, not a few .sty files. */
	optional: boolean;
	/** Compressed size, so the UI can state the cost before spending it. */
	bytes: number;
	/** Content hash — the cache key, and what makes a stale pack detectable. */
	hash: string;
};

export type PackIndex = {
	/** Bumped when the shape changes, so an old cached index is rejected. */
	version: number;
	packs: PackDefinition[];
	provides: Record<string, string>;
};

export const PACK_INDEX_VERSION = 1;

/** A pack present on this device. */
export type InstalledPack = {
	id: string;
	hash: string;
};

// Walks the closure rather than filtering on the flag: a default pack may depend
// on an optional one, and installing it alone would still fail to compile.
export function defaultPacks(index: PackIndex): PackDefinition[] {
	const byId = new Map(index.packs.map((p) => [p.id, p]));
	const wanted = new Set<string>();

	function want(id: string): void {
		if (wanted.has(id)) return;
		wanted.add(id);
		for (const dep of byId.get(id)?.requires ?? []) want(dep);
	}
	for (const pack of index.packs) if (!pack.optional) want(pack.id);

	return index.packs.filter((p) => wanted.has(p.id));
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isPackDefinition(value: unknown): value is PackDefinition {
	if (typeof value !== 'object' || value === null) return false;
	const p = value as PackDefinition;
	return (
		typeof p.id === 'string' &&
		typeof p.label === 'string' &&
		typeof p.description === 'string' &&
		isStringArray(p.packages) &&
		isStringArray(p.requires) &&
		typeof p.optional === 'boolean' &&
		typeof p.bytes === 'number' &&
		typeof p.hash === 'string'
	);
}

// Throws rather than returning a partial index: silently under-reporting what is
// installable reads to the user as "that package is not supported".
export function parsePackIndex(value: unknown): PackIndex {
	if (typeof value !== 'object' || value === null) {
		throw new Error('The package index is malformed.');
	}
	const index = value as PackIndex;

	if (index.version !== PACK_INDEX_VERSION) {
		throw new Error(
			`Unsupported package index version ${String(index.version)} (expected ${PACK_INDEX_VERSION}).`
		);
	}
	if (!Array.isArray(index.packs) || !index.packs.every(isPackDefinition)) {
		throw new Error('The package index contains a malformed pack.');
	}
	if (
		typeof index.provides !== 'object' ||
		index.provides === null ||
		Object.values(index.provides).some((v) => typeof v !== 'string')
	) {
		throw new Error('The package index has a malformed file map.');
	}

	const ids = new Set(index.packs.map((p) => p.id));
	for (const [file, id] of Object.entries(index.provides)) {
		if (!ids.has(id)) {
			throw new Error(`The package index maps ${file} to unknown pack "${id}".`);
		}
	}
	for (const pack of index.packs) {
		for (const id of pack.requires) {
			// An unresolvable dependency installs a pack that still cannot compile.
			if (!ids.has(id)) {
				throw new Error(`Pack "${pack.id}" requires unknown pack "${id}".`);
			}
		}
	}
	return index;
}

// A real package is a single bare token like `fancyhdr.sty`. A healthy compile
// also reports probes that are NOT packages: fonts by name, `tex-text.tec`,
// `foo.sty.aux` cascades, and dotted-stem config lookups (`geometry.cfg.sty`).
// kpathsea finds packages by bare name, so anything with a path separator or a
// dot in its stem is a probe — matching only `^token.(sty|cls)$` excludes them.
function isInstallable(file: string): boolean {
	return /^[^./]+\.(sty|cls)$/.test(file);
}

// Returns both halves: the packs drive the install prompt, and `unsupported`
// must be reported plainly rather than implying an install would help.
export function resolveMissing(
	index: PackIndex,
	missingFiles: readonly string[],
	installed: readonly InstalledPack[] = []
): { packs: PackDefinition[]; unsupported: string[] } {
	const have = new Set(installed.map((p) => p.id));
	const byId = new Map(index.packs.map((p) => [p.id, p]));
	const wanted = new Set<string>();
	const unsupported: string[] = [];

	// Pull in dependencies too, or the install completes and still fails.
	function want(id: string): void {
		if (wanted.has(id) || have.has(id)) return;
		wanted.add(id);
		for (const dep of byId.get(id)?.requires ?? []) want(dep);
	}

	for (const file of missingFiles) {
		const id = index.provides[file];
		// An installed pack that still lacks the file means it is genuinely
		// elsewhere; offering that install again would change nothing.
		if (id && !have.has(id)) want(id);
		else if (!id && isInstallable(file)) unsupported.push(file);
	}

	// Index order, so dependencies come before the packs that need them.
	return {
		packs: index.packs.filter((p) => wanted.has(p.id)),
		unsupported
	};
}
