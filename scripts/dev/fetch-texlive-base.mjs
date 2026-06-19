// Vendor the SwiftLaTeX pdfTeX format dump into our own static assets, so the
// `/texlive` edge route (apps/web/src/routes/texlive/[...path]/+server.ts) can
// serve it from our origin with no upstream dependency. The format (~10 MB) is
// the single biggest, version-pinned file the engine needs; vendoring it lets a
// cold start survive an upstream outage.
//
// Run it when an upstream is reachable, then commit the result (or run it as a
// CI prebuild step). Pin the upstream / file int to the engine version you ship.
//
// Usage:
//   node scripts/dev/fetch-texlive-base.mjs
//   TEXLIVE_UPSTREAM=https://your-server/ node scripts/dev/fetch-texlive-base.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UPSTREAM = (process.env.TEXLIVE_UPSTREAM || 'https://texlive.texlyre.org/').replace(
	/\/?$/,
	'/'
);

// Files to vendor. Keep these paths in sync with the VENDORED map in the
// `/texlive` route. The format int (`10`) is pinned to the bundled engine.
const FILES = ['pdftex/10/swiftlatexpdftex.fmt'];

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATIC_DIR = join(repoRoot, 'apps/web/static/swiftlatex');

// Map an on-demand path to where the route expects the vendored copy.
const destFor = (path) => join(STATIC_DIR, path.split('/').pop());

let failed = 0;
for (const path of FILES) {
	const url = UPSTREAM + path;
	process.stdout.write(`↓ ${url}\n`);
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
		const buf = Buffer.from(await res.arrayBuffer());
		const dest = destFor(path);
		mkdirSync(dirname(dest), { recursive: true });
		writeFileSync(dest, buf);
		process.stdout.write(`✓ ${dest} (${(buf.length / 1e6).toFixed(1)} MB)\n`);
	} catch (err) {
		failed += 1;
		process.stderr.write(`✗ ${path}: ${err.message}\n`);
	}
}

if (failed > 0) {
	process.stderr.write(
		`\n${failed} file(s) failed. The upstream may be down — try again later or set TEXLIVE_UPSTREAM.\n`
	);
	process.exit(1);
}
process.stdout.write('\nDone. Commit the vendored file(s) (consider Git LFS for the ~10 MB format).\n');
