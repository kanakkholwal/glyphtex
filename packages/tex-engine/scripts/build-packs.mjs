// Build the optional package packs and the index that maps files to them.
//
//   node scripts/build-packs.mjs --bundle <core-dir> [--out <dir>]
//
// Each pack converges the same way the core bundle does — compile its fixture,
// feed `result.missingFiles` back in from TeX Live, repeat — but starting from
// the core bundle already loaded, so a pack only ever contains what core does
// not already provide.
//
// See PACKS.md for the design. Requires TeX Live on PATH (use WSL on Windows).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TexEngine } from '../dist/index.js';
import { PACK_FIXTURES } from '../test/fixtures/packs.mjs';
import { packTarGz } from './lib/targz.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const argv = process.argv.slice(2);
function flag(name, fallback) {
	const i = argv.indexOf(name);
	return i === -1 ? fallback : resolve(argv[i + 1]);
}
const bundleDir = flag('--bundle', null);
const outDir = flag('--out', resolve(pkgRoot, '../../crates/tectonic-wasm/output/packs'));
const wasmPath = flag('--wasm', resolve(pkgRoot, '../../crates/tectonic-wasm/output/tectonic_wasm.wasm'));

if (!bundleDir || !existsSync(bundleDir)) {
	console.error('usage: node scripts/build-packs.mjs --bundle <core-dir> [--out <dir>]');
	console.error('The core bundle directory is required: packs are built as the difference');
	console.error('from it, so without it every pack would duplicate the whole of core.');
	process.exit(1);
}
try {
	execFileSync('kpsewhich', ['--version'], { stdio: 'ignore' });
} catch {
	console.error('kpsewhich not found — a TeX Live installation is required (use WSL on Windows).');
	process.exit(1);
}

const config = JSON.parse(readFileSync(resolve(pkgRoot, 'packs.config.json'), 'utf8'));

const lookup = new Map();
function kpse(name) {
	if (lookup.has(name)) return lookup.get(name);
	let path = null;
	try {
		const found = execFileSync('kpsewhich', [name], { encoding: 'utf8' }).trim();
		if (found && existsSync(found)) path = found;
	} catch {
		/* TeX probes speculatively; most of these never exist */
	}
	lookup.set(name, path);
	return path;
}

// Bare names only: the VFS is flat, and an absolute name like `/dev/null` (which
// TeX really does request, and kpsewhich really does resolve) would escape the
// output directory when written.
function isBareName(name) {
	return name !== '' && !name.includes('/') && !name.includes('\\') && name !== '..' && name !== '.';
}

const WASM = new Uint8Array(readFileSync(wasmPath));

/** The core bundle: loaded into every engine, never written into a pack. */
const core = new Map();
for (const name of readdirSync(bundleDir)) {
	const path = join(bundleDir, name);
	if (statSync(path).isFile()) core.set(name, new Uint8Array(readFileSync(path)));
}
console.log(`core bundle: ${core.size} files`);

const fixtures = new Map(PACK_FIXTURES.map((f) => [f.id, f.source]));
for (const pack of config.packs) {
	if (!fixtures.has(pack.id)) {
		console.error(`pack "${pack.id}" has no fixture in test/fixtures/packs.mjs.`);
		console.error('Every pack needs a compiling document — a manifest entry proves nothing.');
		process.exit(1);
	}
}

mkdirSync(outDir, { recursive: true });

const MAX_ROUNDS = 200;
const built = [];
const provides = {};

for (const pack of config.packs) {
	const source = fixtures.get(pack.id);
	/** Files this pack adds on top of core. */
	const extra = new Map();

	function add(name) {
		if (core.has(name) || extra.has(name)) return false;
		if (!isBareName(name)) return false;
		const path = kpse(name);
		if (!path) return false;
		extra.set(name, new Uint8Array(readFileSync(path)));
		return true;
	}

	let converged = false;
	let lastMessage = null;
	let unresolved = [];

	for (let round = 1; round <= MAX_ROUNDS; round++) {
		// Fresh instance per attempt: an aborted compile tears down the wasm stack
		// without unwinding Rust, so a reused engine stays locked and every later
		// round fails for a reason that has nothing to do with the pack.
		const engine = await TexEngine.load(WASM);
		for (const [name, bytes] of core) engine.addFile(name, bytes);
		for (const [name, bytes] of extra) engine.addFile(name, bytes);
		engine.addFile('main.tex', source);

		let result;
		try {
			result = engine.compile({ entry: 'main.tex' });
		} catch (error) {
			lastMessage = String(error.message).slice(0, 120);
			break;
		}

		let gained = 0;
		for (const name of result.missingFiles) if (add(name)) gained++;

		const pdf = result.status === 'failed' ? null : engine.pdf();
		const ok = result.status !== 'failed' && result.status !== 'errors' && pdf && pdf.length > 1000;
		if (ok) {
			converged = true;
			break;
		}

		if (gained === 0) {
			lastMessage = result.message ?? `status ${result.status}`;
			unresolved = result.missingFiles
				.filter((n) => !core.has(n) && !extra.has(n) && kpse(n) === null)
				// Once TeX cannot open `foo.sty` it probes `foo.sty.tex`,
				// `foo.sty.aux`, `foo.sty.clo` and so on. Listing those buries the
				// one name that matters under a dozen that do not exist anywhere.
				.filter((n) => !/\.(sty|cls|def)\.[a-z]+$/.test(n));
			const errors = result.diagnostics.filter((d) => d.severity === 'error');
			if (errors.length) lastMessage = errors[0].message;
			break;
		}
	}

	if (!converged) {
		console.error(`\npack "${pack.id}" does not compile: ${lastMessage}`);
		if (unresolved.length) {
			console.error(`${unresolved.length} file(s) are not in this TeX Live:`);
			for (const n of unresolved.slice(0, 15)) console.error(`  ${n}`);
			console.error('Install the packages providing them:  tlmgr install <package>');
		}
		process.exit(1);
	}

	const { gz, raw, count } = packTarGz(extra);
	const hash = createHash('sha256').update(gz).digest('hex').slice(0, 16);
	writeFileSync(resolve(outDir, `pack-${pack.id}.tar.gz`), gz);

	for (const name of extra.keys()) {
		// A file in two packs would make "which pack do I need" ambiguous and let
		// two copies drift apart. Fail rather than pick one.
		if (provides[name]) {
			console.error(`\n${name} is provided by both "${provides[name]}" and "${pack.id}".`);
			console.error('Move it into one pack, or into the core bundle if both need it.');
			process.exit(1);
		}
		provides[name] = pack.id;
	}

	built.push({
		id: pack.id,
		label: pack.label,
		description: pack.description,
		packages: pack.packages,
		bytes: gz.length,
		hash
	});

	console.log(
		`  ${pack.id.padEnd(12)} ${String(count).padStart(4)} files  ` +
			`${(raw / 1048576).toFixed(1)} MB raw  ${(gz.length / 1048576).toFixed(2)} MB gz`
	);
}

const index = { version: 1, packs: built, provides };
writeFileSync(resolve(outDir, 'packs-index.json'), JSON.stringify(index, null, '\t') + '\n');

const total = built.reduce((n, p) => n + p.bytes, 0);
console.log(`\n${built.length} packs, ${Object.keys(provides).length} files, ${(total / 1048576).toFixed(2)} MB gz total`);
console.log(`-> ${outDir}`);
