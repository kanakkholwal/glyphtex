// Local-dev convenience: make the Tectonic sidecar available for the host so
// `pnpm --filter @glyphtex/desktop tauri dev`/`build` compiles.
//
// With `externalBin: ["binaries/tectonic"]` in tauri.conf.json, Tauri requires
// a `tectonic-<host-triple>[.exe]` file to exist before the Rust crate will
// compile (the `generate_context!` macro validates sidecars). This script
// provides it the cheap way when you already have a `tectonic[.exe]` in the
// binaries dir (it just copies it to the triple-named path), and otherwise
// downloads the pinned release.
//
// Run via: `pnpm --filter @glyphtex/desktop tectonic:setup`

import { copyFileSync, existsSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadTectonic, DEFAULT_TECTONIC_VERSION } from '../release/download-tectonic.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const binariesDir = join(repoRoot, 'apps/desktop/src-tauri/binaries');

/** Map the running Node host to the Rust target triple Tectonic releases use. */
function hostTriple() {
	const p = platform();
	const a = arch();
	if (p === 'win32' && a === 'x64') return 'x86_64-pc-windows-msvc';
	if (p === 'darwin' && a === 'arm64') return 'aarch64-apple-darwin';
	if (p === 'darwin' && a === 'x64') return 'x86_64-apple-darwin';
	if (p === 'linux' && a === 'x64') return 'x86_64-unknown-linux-gnu';
	if (p === 'linux' && a === 'arm64') return 'aarch64-unknown-linux-musl';
	throw new Error(`Unsupported host for Tectonic sidecar: ${p}/${a}`);
}

async function main() {
	const triple = hostTriple();
	const isWindows = triple.includes('windows');
	const ext = isWindows ? '.exe' : '';
	const sidecar = join(binariesDir, `tectonic-${triple}${ext}`);

	if (existsSync(sidecar)) {
		console.log(`✓ sidecar already present: ${sidecar}`);
		return;
	}

	// Reuse a plain `tectonic[.exe]` already in the binaries dir if present —
	// avoids re-downloading ~50 MB when you already fetched the engine.
	const plain = join(binariesDir, `tectonic${ext}`);
	if (existsSync(plain)) {
		copyFileSync(plain, sidecar);
		console.log(`✓ copied existing ${plain}\n      → ${sidecar}`);
		return;
	}

	console.log(`No local Tectonic found — downloading v${DEFAULT_TECTONIC_VERSION} for ${triple}…`);
	await downloadTectonic({ target: triple, dest: binariesDir });
}

main().catch((err) => {
	console.error(`✗ ${err.message}`);
	process.exit(1);
});
