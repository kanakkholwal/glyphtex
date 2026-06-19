// What the first-run "Set up the compiler" dialog can download. The in-browser
// engine is SwiftLaTeX **pdfTeX**, so every package here is pdfLaTeX-compatible
// (no fontspec / XeTeX-only packages). Sizes are rough — TeX Live fetches files
// individually on demand, so these are guidance, not exact byte counts.

export type PackageGroup = {
	id: string;
	label: string;
	/** One-line plain-language description of what it's for. */
	description: string;
	/** Rough download size, MB — for the dialog's running total. */
	approxMB: number;
	/** Packages warmed by compiling a tiny doc that `\usepackage`s them. */
	packages: string[];
};

/**
 * Always downloaded: the WASM engine (~2 MB, usually already precached by the
 * service worker) plus the TeX format + core files (`latex.ltx`, the base
 * classes — ~10 MB). Shown locked-on in the dialog; nothing compiles without it.
 */
export const CORE_APPROX_MB = 12;

/** Optional, toggleable common-package groups (all on by default). */
export const PACKAGE_GROUPS: PackageGroup[] = [
	{
		id: 'math',
		label: 'Math',
		description: 'amsmath, amssymb, mathtools — equations & symbols',
		approxMB: 0.4,
		packages: ['amsmath', 'amssymb', 'amsfonts', 'mathtools']
	},
	{
		id: 'graphics',
		label: 'Graphics & color',
		description: 'graphicx, xcolor — images & colour',
		approxMB: 0.5,
		packages: ['graphicx', 'xcolor']
	},
	{
		id: 'tables',
		label: 'Tables',
		description: 'booktabs, tabularx, array, longtable, multirow',
		approxMB: 0.4,
		packages: ['booktabs', 'tabularx', 'array', 'longtable', 'multirow']
	},
	{
		id: 'layout',
		label: 'Layout & links',
		description: 'geometry, hyperref, enumitem, caption — page setup, links, lists',
		approxMB: 0.8,
		packages: ['geometry', 'hyperref', 'enumitem', 'caption']
	}
];

/** Total estimated download for the core plus the selected group ids. */
export function estimateMB(selectedIds: string[]): number {
	const groups = PACKAGE_GROUPS.filter((g) => selectedIds.includes(g.id)).reduce(
		(sum, g) => sum + g.approxMB,
		0
	);
	return Math.round((CORE_APPROX_MB + groups) * 10) / 10;
}
