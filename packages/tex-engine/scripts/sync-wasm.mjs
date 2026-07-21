// Copy the freshly built engine into the package so it can be packed or tested.
//
// The binary is a build output of crates/tectonic-wasm and is gitignored here;
// CI does the same copy before `npm publish`.
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const source =
	process.argv[2] ??
	resolve(pkgRoot, '../../crates/tectonic-wasm/output/tectonic_wasm.wasm');

if (!existsSync(source)) {
	console.error(`No engine at ${source}`);
	console.error('Build it first:  cd crates/tectonic-wasm && ./scripts/build-wasm.sh');
	process.exit(1);
}

const destDir = resolve(pkgRoot, 'wasm');
mkdirSync(destDir, { recursive: true });
const dest = resolve(destDir, 'tectonic_wasm.wasm');
copyFileSync(source, dest);

const mb = (statSync(dest).size / 1048576).toFixed(2);
console.log(`copied engine (${mb} MB) -> wasm/tectonic_wasm.wasm`);
