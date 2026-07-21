// Check the shipped TeX bundle against bundle-manifest.json.
//
// The installer UI offers package groups by name. If the bundle cannot satisfy
// one, the user sees an inscrutable TeX error rather than a missing feature —
// so a gap here is a release blocker, not a warning.
//
//   node scripts/verify-bundle.mjs [path/to/bundle.tar.gz | path/to/dir]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const manifest = JSON.parse(readFileSync(resolve(pkgRoot, 'bundle-manifest.json'), 'utf8'));

const target =
	process.argv[2] ??
	resolve(pkgRoot, '../../crates/tectonic-wasm/output/tectonic-bundle.tar.gz');

if (!existsSync(target)) {
	console.error(`Bundle not found: ${target}`);
	process.exit(1);
}

/** Every file name the bundle provides, without directory components. */
function bundleContents(path) {
	if (statSync(path).isDirectory()) {
		return new Set(readdirSync(path));
	}
	// GNU tar reads a leading `C:` as a remote host spec ("Cannot connect to C").
	// --force-local suppresses that, but BSD tar (macOS) has no such flag and
	// needs no such fix.
	// The dashed form matters: old-style `tzf` must be the first argument, so it
	// cannot be combined with a preceding --force-local.
	const args = ['-tzf', path];
	if (process.platform === 'win32') args.push('--force-local');
	const listing = execFileSync('tar', args, { encoding: 'utf8' });
	return new Set(
		listing
			.split('\n')
			.map((line) => line.trim().replace(/^\.\//, ''))
			.filter((line) => line && !line.endsWith('/'))
	);
}

const present = bundleContents(target);
console.log(`bundle: ${target}`);
console.log(`files:  ${present.size}\n`);

let missingTotal = 0;
for (const group of manifest.groups) {
	const missing = group.files.filter((f) => !present.has(f));
	missingTotal += missing.length;
	const mark = missing.length === 0 ? 'ok  ' : 'GAP ';
	console.log(`${mark} ${group.label.padEnd(20)} ${group.files.length - missing.length}/${group.files.length}`);
	for (const f of missing) console.log(`       missing: ${f}`);
}

if (missingTotal > 0) {
	console.error(
		`\n${missingTotal} file(s) missing. Either extend the bundle ` +
			`(pnpm bundle:extend) or remove the affected group from bundle-manifest.json ` +
			`and the installer UI — do not ship a group the engine cannot compile.`
	);
	process.exit(1);
}

console.log('\nAll manifest groups are satisfied.');
