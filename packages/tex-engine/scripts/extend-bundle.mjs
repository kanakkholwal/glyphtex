// Add the files bundle-manifest.json requires but the bundle lacks, sourcing
// them from a local TeX Live installation via kpsewhich.
//
//   node scripts/extend-bundle.mjs [bundleDir]
//
// Dependency resolution is approximate: it follows \RequirePackage,
// \usepackage, \LoadClass and \input references transitively. TeX's real
// resolution is Turing-complete, so this cannot be exhaustive — it is a
// bootstrap. The robust path is to compile a document and feed the engine's
// own `missingFiles` back in, which needs no guessing at all.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const manifest = JSON.parse(readFileSync(resolve(pkgRoot, 'bundle-manifest.json'), 'utf8'));
const bundleDir = resolve(process.argv[2] ?? resolve(pkgRoot, '../../crates/tectonic-wasm/bundle'));

mkdirSync(bundleDir, { recursive: true });

function kpsewhich(name) {
	try {
		const out = execFileSync('kpsewhich', [name], { encoding: 'utf8' }).trim();
		return out && existsSync(out) ? out : null;
	} catch {
		return null;
	}
}

try {
	execFileSync('kpsewhich', ['--version'], { stdio: 'ignore' });
} catch {
	console.error('kpsewhich not found — a local TeX Live installation is required.');
	console.error('On Windows the binaries live under e.g. C:\\texlive\\2026\\bin\\windows.');
	process.exit(1);
}

const present = new Set(readdirSync(bundleDir));
const queue = manifest.groups.flatMap((g) => g.files).filter((f) => !present.has(f));
const seen = new Set(queue);
const added = [];
const unresolved = [];

// Extensionless \usepackage{x} means x.sty; \LoadClass{y} means y.cls.
const REFERENCE = /\\(?:RequirePackage|usepackage)(?:\[[^\]]*\])?\{([^}]+)\}|\\LoadClass(?:\[[^\]]*\])?\{([^}]+)\}|\\input\s*\{?([\w./-]+)\}?/g;

while (queue.length) {
	const name = queue.shift();
	const path = kpsewhich(name);
	if (!path) {
		unresolved.push(name);
		continue;
	}
	copyFileSync(path, resolve(bundleDir, name));
	added.push(name);

	// Only text files can declare dependencies; skip fonts and format dumps.
	if (!/\.(sty|cls|def|cfg|tex|clo|fd)$/.test(name)) continue;

	const source = readFileSync(path, 'utf8');
	for (const m of source.matchAll(REFERENCE)) {
		const raw = m[1] ?? m[2] ?? m[3] ?? '';
		for (const item of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
			const dep = m[2] ? `${item}.cls` : /\.\w+$/.test(item) ? item : `${item}.sty`;
			if (!seen.has(dep) && !present.has(dep)) {
				seen.add(dep);
				queue.push(dep);
			}
		}
	}
}

console.log(`added ${added.length} file(s) to ${bundleDir}`);
if (unresolved.length) {
	console.log(`\n${unresolved.length} not found in the local TeX Live:`);
	for (const n of unresolved.slice(0, 40)) console.log(`  ${n}`);
	console.log('\nSome of these are optional or conditionally loaded; verify with:');
	console.log('  pnpm bundle:verify');
}
