// Stamp the release version (from the pushed tag) into the desktop app's
// manifests so the built installer, the Cargo crate and the npm package all
// report the same version as the GitHub release.
//
// Reads the tag from the `TAG` env var (e.g. `v0.1.0`), strips a leading `v`,
// and writes the bare semver into:
//   - apps/desktop/src-tauri/tauri.conf.json  ("version")
//   - apps/desktop/src-tauri/Cargo.toml       ([package] version)
//   - apps/desktop/package.json               ("version")
//
// Usage (CI):  TAG=v0.1.0 node scripts/release/sync-version.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const tag = process.env.TAG;
if (!tag) {
	console.error("✗ TAG env var is required (e.g. TAG=v0.1.0)");
	process.exit(1);
}

const version = tag.replace(/^v/, "");
if (!/^\d+\.\d+\.\d+/.test(version)) {
	console.error(`✗ TAG "${tag}" does not look like a semver tag (vMAJOR.MINOR.PATCH)`);
	process.exit(1);
}

function updateJson(relPath, mutate) {
	const path = join(repoRoot, relPath);
	const json = JSON.parse(readFileSync(path, "utf8"));
	mutate(json);
	writeFileSync(path, `${JSON.stringify(json, null, "\t")}\n`);
	console.log(`✓ ${relPath} → ${version}`);
}

// Cargo.toml: rewrite the `version` of the [package] section only, leaving any
// dependency `version =` lines untouched.
function updateCargoVersion(relPath) {
	const path = join(repoRoot, relPath);
	const lines = readFileSync(path, "utf8").split(/\r?\n/);
	let inPackage = false;
	let done = false;
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		if (/^\s*\[/.test(line)) inPackage = /^\s*\[package\]\s*$/.test(line);
		if (inPackage && !done && /^\s*version\s*=/.test(line)) {
			lines[i] = `version = "${version}"`;
			done = true;
		}
	}
	if (!done) throw new Error(`Could not find [package] version in ${relPath}`);
	writeFileSync(path, lines.join("\n"));
	console.log(`✓ ${relPath} → ${version}`);
}

updateJson("apps/desktop/src-tauri/tauri.conf.json", (j) => {
	j.version = version;
});
updateCargoVersion("apps/desktop/src-tauri/Cargo.toml");
updateJson("apps/desktop/package.json", (j) => {
	j.version = version;
});
