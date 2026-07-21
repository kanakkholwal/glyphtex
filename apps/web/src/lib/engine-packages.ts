// What the first-run "Set up the compiler" dialog can download. The in-browser
// engine is SwiftLaTeX **pdfTeX**, so every package here is pdfLaTeX-compatible
// (no fontspec / XeTeX-only packages). Sizes are rough — TeX Live fetches files
// individually on demand, so these are guidance, not exact byte counts.
//
// Deliberately absent, so nobody "helpfully" adds them later:
//   - **Bibliography** (biblatex / natbib). The .sty files fetch fine, but this
//     engine build ships **no bibtex binary at all** and biber is Perl (no WASM
//     build exists), so citations would still render as [?]. Offering the group
//     would promise something that cannot work. Desktop handles bibliographies.
//   - **minted**. Needs a Python/Pygments subprocess — impossible in WASM.
//     Use `listings` instead (pure TeX, no external process).
//   - **fontspec / unicode-math**. XeTeX/LuaTeX only; this is pdfTeX.

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
		// subcaption ships inside `caption`; cleveref must be loaded after hyperref.
		packages: ['geometry', 'hyperref', 'enumitem', 'caption', 'subcaption', 'cleveref']
	},
	{
		id: 'drawing',
		label: 'Diagrams & plots',
		// pgf/TikZ is by far the largest item here and it is not really optional:
		// beamer and tcolorbox both depend on it, so selecting either pulls this
		// tree anyway.
		description: 'TikZ, pgfplots — diagrams, charts & plots',
		approxMB: 4.5,
		packages: ['tikz', 'pgfplots']
	},
	{
		id: 'slides',
		label: 'Presentations',
		description: 'beamer — slide decks',
		approxMB: 1.5,
		packages: ['beamer']
	},
	{
		id: 'code',
		label: 'Code & algorithms',
		// listings reads source directly in TeX — no external highlighter, so
		// unlike minted it works in the browser.
		description: 'listings, algorithm2e — code blocks & pseudocode',
		approxMB: 0.5,
		packages: ['listings', 'algorithm2e']
	},
	{
		id: 'typography',
		label: 'Typography',
		// Full microtype: this is pdfTeX, so font expansion works here — the
		// feature XeTeX-based engines (including desktop Tectonic) don't get.
		description: 'microtype, siunitx, lmodern — refined spacing, units, fonts',
		approxMB: 1.2,
		packages: ['microtype', 'siunitx', 'lmodern']
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
