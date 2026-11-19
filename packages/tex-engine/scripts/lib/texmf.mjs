// Find TeX Live files by basename glob — for file sets convergence cannot reach.
//
// XeTeX font loading and `\IfFileExists` probes never surface in `missingFiles`,
// so an enumerable set (lmodern's fonts, beamer's themes) has to be pulled in
// wholesale. `*` is the only wildcard.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Macros and .fd files live under tex/, fonts under fonts/, and BibTeX's .bst
// styles under bibtex/ — a tree of its own that neither of the others reaches.
export function globTexmf(patterns, subdirs = ["tex", "fonts", "bibtex"]) {
	if (!patterns || patterns.length === 0) return new Map();
	// Resolved here, not at import: a build from --texmf has no TeX Live and never gets this far.
	const TEXMF =
		process.env.GLYPHTEX_TEXMF ??
		execFileSync("kpsewhich", ["-var-value=TEXMFDIST"], { encoding: "utf8" }).trim();
	const res = patterns.map(
		(p) => new RegExp("^" + p.replace(/[.]/g, "\\$&").replace(/\*/g, ".*") + "$")
	);
	const out = new Map();
	const walk = (dir) => {
		// A plain --texmf folder need not have fonts/ or bibtex/ trees.
		if (!existsSync(dir)) return;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (res.some((r) => r.test(entry.name))) out.set(entry.name, full);
		}
	};
	for (const sub of subdirs) walk(join(TEXMF, sub));
	return out;
}
