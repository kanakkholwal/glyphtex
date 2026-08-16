// Download a pinned Tectonic release binary and place it as a Tauri sidecar.
//
// Tectonic is bundled with the desktop app as an `externalBin` sidecar (see
// apps/desktop/src-tauri/tauri.conf.json). Tauri validates that a binary named
// `tectonic-<target-triple>[.exe]` exists for the build target at compile time
// (`tauri::generate_context!`) and copies it next to the app executable in the
// installer. This script fetches that binary from the Tectonic GitHub release.
//
// Usage:
//   node scripts/release/download-tectonic.mjs \
//     --target x86_64-pc-windows-msvc \
//     --version 0.16.9 \
//     --dest apps/desktop/src-tauri/binaries
//
// `--version` defaults to DEFAULT_TECTONIC_VERSION below; keep it in sync with
// the TECTONIC_VERSION env in the CI / release workflows so every build leg
// ships the same engine. Bump deliberately — do NOT track "latest".

import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	statSync,
	writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TECTONIC_REPO = "tectonic-typesetting/tectonic";
export const DEFAULT_TECTONIC_VERSION = "0.16.9";

/**
 * Download + extract Tectonic for one target triple into `dest`, named
 * `tectonic-<target>[.exe]`. Returns the absolute path written.
 */
export async function downloadTectonic({ target, version = DEFAULT_TECTONIC_VERSION, dest }) {
	if (!target) throw new Error("downloadTectonic: `target` (rust triple) is required");
	if (!dest) throw new Error("downloadTectonic: `dest` directory is required");

	const isWindows = target.includes("windows");
	const ext = isWindows ? "zip" : "tar.gz";
	const binName = isWindows ? "tectonic.exe" : "tectonic";
	const asset = `tectonic-${version}-${target}.${ext}`;
	// The git tag is `tectonic@<version>`; `@` must be percent-encoded in the URL.
	const url = `https://github.com/${TECTONIC_REPO}/releases/download/tectonic%40${version}/${asset}`;

	mkdirSync(dest, { recursive: true });
	const work = mkdtempSync(join(tmpdir(), "tectonic-"));
	const archivePath = join(work, asset);

	console.log(`↓ ${url}`);
	const res = await fetch(url, { redirect: "follow" });
	if (!res.ok) {
		throw new Error(`Download failed (${res.status} ${res.statusText}): ${url}`);
	}
	writeFileSync(archivePath, Buffer.from(await res.arrayBuffer()));

	// `tar -xf` autodetects the format: bsdtar (preinstalled on Windows runners)
	// extracts .zip, and GNU/BSD tar on macOS/Linux extracts .tar.gz — so one
	// command covers every platform without needing unzip / Expand-Archive.
	const untar = spawnSync("tar", ["-xf", archivePath, "-C", work], { stdio: "inherit" });
	if (untar.status !== 0) {
		throw new Error(`Extraction failed for ${asset} (tar exit ${untar.status})`);
	}

	// cargo-dist archives keep the binary at the archive root, but search
	// recursively to be resilient to a future layout change.
	const binSrc = findFile(work, binName, archivePath);
	if (!binSrc) throw new Error(`Could not find ${binName} inside ${asset}`);

	const outName = isWindows ? `tectonic-${target}.exe` : `tectonic-${target}`;
	const outPath = join(dest, outName);
	copyFileSync(binSrc, outPath);
	if (!isWindows) chmodSync(outPath, 0o755);
	console.log(`✓ ${outPath}`);
	return outPath;
}

/** Recursively find a file named `name` under `dir`, ignoring the archive itself. */
function findFile(dir, name, ignore) {
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry);
		if (p === ignore) continue;
		const s = statSync(p);
		if (s.isDirectory()) {
			const found = findFile(p, name, ignore);
			if (found) return found;
		} else if (entry === name) {
			return p;
		}
	}
	return null;
}

function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i += 1) {
		const a = argv[i];
		if (a === "--target") out.target = argv[++i];
		else if (a === "--version") out.version = argv[++i];
		else if (a === "--dest") out.dest = argv[++i];
	}
	return out;
}

// Run as a CLI when invoked directly (not when imported).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const { target, version, dest } = parseArgs(process.argv.slice(2));
	const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
	downloadTectonic({
		target,
		version: version || process.env.TECTONIC_VERSION || DEFAULT_TECTONIC_VERSION,
		dest: dest || join(repoRoot, "apps/desktop/src-tauri/binaries")
	}).catch((err) => {
		console.error(`✗ ${err.message}`);
		process.exit(1);
	});
}
