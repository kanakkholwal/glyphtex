// Every pack fixture, compiled against the packs that actually ship.
//
// build-packs proves a pack compiles when it is built; this proves the committed
// tarballs still do, so a pack rebuilt from another TeX Live snapshot (the way
// `science` broke against TeX Live 2026-10) fails here instead of in a browser.
// Each pack gets only core plus its declared `requires`: packs must be
// self-sufficient given core (PACKS.md).
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { parsePackIndex, TexEngine } from "../dist/index.js";
import { PACK_FIXTURES } from "./fixtures/packs.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const wasmPath = process.env.GLYPHTEX_WASM
	? resolve(process.env.GLYPHTEX_WASM)
	: resolve(here, "../../../crates/tectonic-wasm/output/tectonic_wasm.wasm");
const bundleDir = process.env.GLYPHTEX_BUNDLE ? resolve(process.env.GLYPHTEX_BUNDLE) : null;
const packsDir = process.env.GLYPHTEX_PACKS
	? resolve(process.env.GLYPHTEX_PACKS)
	: resolve(here, "../wasm/packs");

const haveArtifacts =
	existsSync(wasmPath) &&
	bundleDir !== null &&
	existsSync(bundleDir) &&
	existsSync(join(packsDir, "packs-index.json"));

if (process.env.GLYPHTEX_REQUIRE_ENGINE && !haveArtifacts) {
	throw new Error(
		`GLYPHTEX_REQUIRE_ENGINE is set but wasm, bundle or packs are missing (packs: ${packsDir})`
	);
}

/** Regular files of a POSIX ustar archive, by name. Enough for the packs this repo builds. */
function untar(bytes) {
	const files = new Map();
	const text = (at, len) => {
		const slice = bytes.subarray(at, at + len);
		const end = slice.indexOf(0);
		return Buffer.from(end === -1 ? slice : slice.subarray(0, end)).toString("utf8");
	};
	for (let at = 0; at + 512 <= bytes.length; ) {
		const name = text(at, 100);
		if (!name) break;
		const size = Number.parseInt(text(at + 124, 12).trim() || "0", 8);
		const type = String.fromCharCode(bytes[at + 156] || 48);
		const prefix = text(at + 345, 155);
		if (type === "0") {
			const full = prefix ? `${prefix}/${name}` : name;
			files.set(full.split("/").pop(), bytes.subarray(at + 512, at + 512 + size));
		}
		at += 512 + Math.ceil(size / 512) * 512;
	}
	return files;
}

describe("pack fixtures", { skip: haveArtifacts ? false : "wasm, bundle or packs not available" }, () => {
	const index = haveArtifacts
		? parsePackIndex(JSON.parse(readFileSync(join(packsDir, "packs-index.json"), "utf8")))
		: { packs: [] };
	const byId = new Map(index.packs.map((p) => [p.id, p]));
	const wasm = haveArtifacts ? readFileSync(wasmPath) : null;

	function closure(id, seen = new Set()) {
		if (seen.has(id)) return seen;
		seen.add(id);
		for (const dep of byId.get(id)?.requires ?? []) closure(dep, seen);
		return seen;
	}

	test("every shipped pack has a fixture, and every fixture a pack", () => {
		assert.deepEqual(
			[...byId.keys()].sort(),
			PACK_FIXTURES.map((f) => f.id).sort(),
			"packs-index.json and test/fixtures/packs.mjs disagree"
		);
	});

	for (const fixture of PACK_FIXTURES) {
		test(`${fixture.id} compiles against core and its own pack`, async () => {
			// Fresh engine per pack: an aborted compile poisons the instance.
			const engine = await TexEngine.load(wasm);
			for (const name of readdirSync(bundleDir)) {
				const p = join(bundleDir, name);
				if (statSync(p).isFile()) engine.addFile(name, readFileSync(p));
			}
			for (const id of closure(fixture.id)) {
				assert.ok(byId.has(id), `pack "${id}" is not in packs-index.json`);
				engine.addFiles(untar(gunzipSync(readFileSync(join(packsDir, `pack-${id}.tar.gz`)))));
			}
			for (const [name, text] of Object.entries(fixture.files ?? {})) engine.addFile(name, text);
			engine.addFile("main.tex", fixture.source);

			const result = engine.compile({ entry: "main.tex", maxPasses: 5 });
			const errors = (engine.log() ?? "").split("\n").filter((line) => line.startsWith("!"));
			assert.notEqual(result.status, "failed", result.message ?? errors.join("\n"));
			assert.deepEqual(errors, [], `TeX errors in ${fixture.id}`);
			assert.ok((engine.pdf()?.length ?? 0) > 1000, `${fixture.id} produced no real PDF`);
		});
	}
});
