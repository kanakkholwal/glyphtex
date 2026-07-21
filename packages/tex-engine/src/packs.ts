// Package packs: optional, independently installable sets of TeX files.
//
// See PACKS.md for the design. The short version: the core bundle is exactly as
// wide as the fixtures that built it, so anything beyond it ships as a pack —
// the same deterministic tarball shape, downloaded and cached separately.
//
// This module is the contract. The build script writes JSON that conforms to
// it; the runtime narrows before trusting it.

/** A pack as described by the generated index. */
export type PackDefinition = {
	/** Stable identifier, also the tarball basename: `pack-<id>.tar.gz`. */
	id: string;
	/** Human label for the installer UI. */
	label: string;
	/** One line on what it is for. */
	description: string;
	/** TeX Live package names this pack covers, for display and traceability. */
	packages: string[];
	/** Compressed size, so the UI can state the cost before spending it. */
	bytes: number;
	/** Content hash — the cache key, and what makes a stale pack detectable. */
	hash: string;
};

/**
 * The generated pack index.
 *
 * `provides` maps a filename to the pack id that supplies it. It is the inverse
 * of each pack's file list, and it is what turns a missing-file failure into a
 * named, one-click install instead of a raw TeX error.
 */
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
		typeof p.bytes === 'number' &&
		typeof p.hash === 'string'
	);
}

/**
 * Parse an untrusted pack index (AGENTS.md rule 4).
 *
 * Throws rather than returning a partial index: a half-understood index would
 * silently under-report what is installable, which reads to the user as "that
 * package is not supported" — the exact wrong message.
 */
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
	return index;
}

/**
 * Which packs would satisfy these missing files, and which files nothing covers.
 *
 * Both halves matter: the installable set drives the prompt, and the
 * `unsupported` remainder is what must be reported plainly instead of implying
 * an install would help.
 */
export function resolveMissing(
	index: PackIndex,
	missingFiles: readonly string[],
	installed: readonly InstalledPack[] = []
): { packs: PackDefinition[]; unsupported: string[] } {
	const have = new Set(installed.map((p) => p.id));
	const wanted = new Set<string>();
	const unsupported: string[] = [];

	for (const file of missingFiles) {
		const id = index.provides[file];
		// An already-installed pack that still cannot supply the file means the
		// file is genuinely elsewhere — treat it as unsupported rather than
		// offering an install that would change nothing.
		if (id && !have.has(id)) wanted.add(id);
		else if (!id) unsupported.push(file);
	}

	return {
		packs: index.packs.filter((p) => wanted.has(p.id)),
		unsupported
	};
}
