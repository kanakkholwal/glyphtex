// Refuses to publish a package that looks complete but cannot typeset.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8'));

const problems = [];
const note = (label, detail) => console.log(`  ${label.padEnd(30)} ${detail}`);

console.log(`\n${pkg.name}@${pkg.version}\n`);

for (const rel of ['dist/index.js', 'dist/index.d.ts']) {
	if (!existsSync(resolve(pkgRoot, rel))) problems.push(`${rel} is missing — run: pnpm build`);
}

const wasm = resolve(pkgRoot, 'wasm/tectonic_wasm.wasm');
const bundle = resolve(pkgRoot, 'wasm/tectonic-bundle.tar.gz');
for (const p of [wasm, bundle]) {
	if (!existsSync(p)) problems.push(`${p} is missing — run: pnpm sync:wasm`);
}
if (existsSync(wasm)) note('engine', `${(statSync(wasm).size / 1048576).toFixed(2)} MB`);
if (existsSync(bundle)) note('core bundle', `${(statSync(bundle).size / 1048576).toFixed(2)} MB`);

// Every pack is non-optional, so a consumer missing them gets an engine that
// fails on \usetheme and \rowcolor while looking fine.
const packsDir = resolve(pkgRoot, 'wasm/packs');
const indexPath = resolve(packsDir, 'packs-index.json');
if (!existsSync(indexPath)) {
	problems.push('wasm/packs/packs-index.json is missing — run: pnpm sync:wasm');
} else {
	const index = JSON.parse(readFileSync(indexPath, 'utf8'));
	const absent = index.packs.filter((p) => !existsSync(resolve(packsDir, `pack-${p.id}.tar.gz`)));
	if (absent.length) problems.push(`packs declared but not present: ${absent.map((p) => p.id).join(', ')}`);

	const bytes = readdirSync(packsDir).reduce((n, f) => n + statSync(resolve(packsDir, f)).size, 0);
	note('packs', `${(bytes / 1048576).toFixed(2)} MB, ${index.packs.length} packs`);
}

// A subpath that resolves to nothing is only discovered by whoever installs it.
for (const [subpath, target] of Object.entries(pkg.exports)) {
	if (typeof target !== 'string' || subpath.includes('*')) continue;
	if (!existsSync(resolve(pkgRoot, target))) problems.push(`exports["${subpath}"] -> ${target} does not exist`);
}

const packed = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], {
	cwd: pkgRoot,
	encoding: 'utf8',
	shell: process.platform === 'win32'
}))[0];
note('tarball', `${(packed.size / 1048576).toFixed(2)} MB (${packed.entryCount} files)`);
note('unpacked', `${(packed.unpackedSize / 1048576).toFixed(2)} MB`);

if (problems.length) {
	console.error(`\n${problems.length} problem(s):`);
	for (const p of problems) console.error(`  ${p}`);
	process.exit(1);
}

console.log('\nReady to publish:  npm publish --access public\n');
