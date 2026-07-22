// Find TeX Live files by basename glob — for file sets convergence cannot reach.
//
// XeTeX font loading and `\IfFileExists` probes never surface in `missingFiles`,
// so an enumerable set (lmodern's fonts, beamer's themes) has to be pulled in
// wholesale. `*` is the only wildcard.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const TEXMF = execFileSync('kpsewhich', ['-var-value=TEXMFDIST'], { encoding: 'utf8' }).trim();

// Fonts live under fonts/, macros and .fd files under tex/, so cover both.
export function globTexmf(patterns, subdirs = ['tex', 'fonts']) {
	if (!patterns || patterns.length === 0) return new Map();
	const res = patterns.map(
		(p) => new RegExp('^' + p.replace(/[.]/g, '\\$&').replace(/\*/g, '.*') + '$')
	);
	const out = new Map();
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (res.some((r) => r.test(entry.name))) out.set(entry.name, full);
		}
	};
	for (const sub of subdirs) walk(join(TEXMF, sub));
	return out;
}
