// Headless capture of the TeX Live base bundle — the automated counterpart to
// the manual "MIRROR_WRITE=1 dev + compile in your browser" flow.
//
// It just *drives a compile*: it opens the editor in a headless browser and runs
// the first-run install (which compiles the format + every package group). The
// actual writing is done by the `/texlive` route, which persists every proxied
// file to apps/web/static/texmirror/ when the dev server runs with MIRROR_WRITE=1.
// So this script needs no Playwright and downloads no browser — it uses the
// machine's already-installed Chrome via puppeteer-core.
//
// Prereqs:
//   1. A reachable upstream (texlyre or your PUBLIC_TEXLIVE_ENDPOINT).
//   2. The dev server running WITH the write flag:
//        MIRROR_WRITE=1 pnpm --filter @glyphx/web dev
//   3. puppeteer-core + a Chrome/Chromium on PATH (CI runners ship Chrome):
//        pnpm add -D puppeteer-core
//
// Usage:
//   CAPTURE_BASE_URL=http://localhost:5173 \
//   CHROME_PATH=/usr/bin/google-chrome \
//   node scripts/dev/capture-texlive-base.mjs

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = (process.env.CAPTURE_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIRROR_DIR = join(repoRoot, 'apps/web/static/texmirror');

// The machine's Chrome — never downloaded. CI runners ship Google Chrome.
const executablePath = [
	process.env.CHROME_PATH,
	'/usr/bin/google-chrome',
	'/usr/bin/google-chrome-stable',
	'/usr/bin/chromium-browser',
	'/usr/bin/chromium',
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].find((p) => p && existsSync(p));

if (!executablePath) {
	process.stderr.write('No Chrome/Chromium found — set CHROME_PATH to its executable.\n');
	process.exit(1);
}

let puppeteer;
try {
	puppeteer = (await import('puppeteer-core')).default;
} catch {
	process.stderr.write('puppeteer-core is not installed. Run:  pnpm add -D puppeteer-core\n');
	process.exit(1);
}

const browser = await puppeteer.launch({
	executablePath,
	headless: true,
	args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
	const page = await browser.newPage();
	page.on('console', (m) => {
		if (m.type() === 'error') process.stderr.write(`  [page] ${m.text()}\n`);
	});

	process.stdout.write(`Opening ${BASE_URL}/editor …\n`);
	await page.goto(`${BASE_URL}/editor`, { waitUntil: 'domcontentloaded' });

	// Click the install dialog's "Download & install" (located by visible text,
	// so it survives markup changes better than a brittle selector).
	const clickInstall = () =>
		page.evaluate(() => {
			const btn = [...document.querySelectorAll('button')].find((b) =>
				/download & install/i.test(b.textContent || '')
			);
			if (!btn) return false;
			btn.click();
			return true;
		});

	await page.waitForFunction(
		() =>
			[...document.querySelectorAll('button')].some((b) =>
				/download & install/i.test(b.textContent || '')
			),
		{ timeout: 30_000 }
	);
	if (!(await clickInstall())) throw new Error('Install button not found.');
	process.stdout.write('Running install (pulls format + packages — can take a few minutes)…\n');

	// Wait until the engine reports ready (install finished). The route writes
	// each fetched file to the mirror as it streams.
	await page.waitForFunction(() => localStorage.getItem('glyphx:web-engine-ready') === '1', {
		timeout: 8 * 60_000
	});
	// Let trailing writes flush.
	await new Promise((r) => setTimeout(r, 2_000));
} finally {
	await browser.close();
}

// Report what the route wrote.
let count = 0;
let bytes = 0;
const walk = (dir) => {
	for (const name of existsSync(dir) ? readdirSync(dir) : []) {
		const p = join(dir, name);
		const s = statSync(p);
		if (s.isDirectory()) walk(p);
		else {
			count += 1;
			bytes += s.size;
		}
	}
};
walk(MIRROR_DIR);

process.stdout.write(
	`\nMirror now holds ${count} file(s), ${(bytes / 1e6).toFixed(1)} MB → ${MIRROR_DIR}\n` +
		'Commit static/texmirror/ (Git LFS recommended for the ~10 MB format).\n'
);
if (count === 0) {
	process.stderr.write('No files captured — did the dev server run with MIRROR_WRITE=1?\n');
	process.exit(1);
}
