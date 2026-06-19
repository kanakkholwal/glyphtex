// Capture the TeX Live BASE BUNDLE by recording exactly which files a real
// compile fetches, and vendoring them under `apps/web/static/texmirror/`. The
// `/texlive` route then serves these from our own origin — so common compiles
// work fully independent of any third-party server (the hybrid's "base bundle"
// half; your dedicated upstream covers the long tail).
//
// It drives the app's first-run install (which compiles the format + every
// package group), and snapshots every `/pdftex/...` response. Re-run it when you
// bump the engine or want a wider bundle; then commit `static/texmirror/`
// (consider Git LFS — the format alone is ~10 MB).
//
// Prereqs:
//   1. A reachable upstream (texlyre or your PUBLIC_TEXLIVE_ENDPOINT).
//   2. The web dev server running:  pnpm --filter @glyphx/web dev
//   3. Playwright:  pnpm add -D playwright && pnpm exec playwright install chromium
//
// Usage:
//   CAPTURE_BASE_URL=http://localhost:5173 node scripts/dev/capture-texlive-base.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = (process.env.CAPTURE_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIRROR_DIR = join(repoRoot, 'apps/web/static/texmirror');

let chromium;
try {
	({ chromium } = await import('playwright'));
} catch {
	process.stderr.write(
		'Playwright is not installed. Run:\n' +
			'  pnpm add -D playwright && pnpm exec playwright install chromium\n'
	);
	process.exit(1);
}

const saved = new Map(); // mirror-relative path -> byte length
const pending = [];

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', (resp) => {
	pending.push(
		(async () => {
			try {
				const url = new URL(resp.url());
				if (!url.pathname.includes('/pdftex/') || resp.status() !== 200) return;
				// `/texlive/pdftex/10/foo` -> `pdftex/10/foo`
				const rel = url.pathname.replace(/^\/texlive\//, '').replace(/^\//, '');
				if (saved.has(rel)) return;
				const buf = await resp.body();
				if (!buf?.length) return;
				saved.set(rel, buf.length);
				const dest = join(MIRROR_DIR, ...rel.split('/'));
				mkdirSync(dirname(dest), { recursive: true });
				writeFileSync(dest, buf);
				process.stdout.write(`  + ${rel} (${(buf.length / 1024).toFixed(0)} KB)\n`);
			} catch {
				/* skip an individual file we couldn't read */
			}
		})()
	);
});

process.stdout.write(`Opening ${BASE_URL}/editor …\n`);
await page.goto(`${BASE_URL}/editor`, { waitUntil: 'domcontentloaded' });

// Drive the first-run install dialog: it compiles the format + each package
// group, which is exactly the base bundle we want to capture.
const installBtn = page.getByRole('button', { name: /download & install/i });
await installBtn.waitFor({ state: 'visible', timeout: 30_000 });
process.stdout.write('Running install (this pulls the format + packages — can take a few minutes)…\n');
await installBtn.click();

// Wait until the engine reports ready (install completed). The format is ~10 MB
// and proxied from upstream in dev, so allow a generous timeout.
try {
	await page.waitForFunction(() => localStorage.getItem('glyphx:web-engine-ready') === '1', {
		timeout: 8 * 60_000
	});
} catch {
	process.stderr.write(
		'Install did not finish in time — is an upstream reachable? Capturing what we got.\n'
	);
}

// Let any trailing responses land, then flush all writes.
await page.waitForTimeout(2_000);
await Promise.all(pending);
await browser.close();

const totalKB = [...saved.values()].reduce((a, b) => a + b, 0) / 1024;
process.stdout.write(
	`\nCaptured ${saved.size} file(s), ${(totalKB / 1024).toFixed(1)} MB → ${MIRROR_DIR}\n` +
		'Commit static/texmirror/ (consider Git LFS for the format). Anything not in the\n' +
		'bundle still falls back to your upstream / texlyre and is cached at the edge.\n'
);

if (saved.size === 0) process.exit(1);
