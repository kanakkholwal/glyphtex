// Decides what a device must download to match the deployed compiler.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { planUpdate } from "./.build/tex/update-plan.mjs";

const manifest = {
	version: "v2",
	totalBytes: 1000,
	files: {
		"tectonic_wasm.wasm": { bytes: 400, hash: "a" },
		"tectonic-bundle.tar.gz": { bytes: 600, hash: "b" }
	}
};
const pack = (id, hash, bytes = 10) => ({ id, label: id.toUpperCase(), hash, bytes });
const packs = [pack("writing", "w1"), pack("mnras", "m1", 30), pack("icons", "i1", 500)];

const core = (v) => [
	`/engine/tectonic_wasm.wasm?v=${v}`,
	`/engine/tectonic-bundle.tar.gz?v=${v}`,
	"/engine/manifest.json"
];
const cachedPack = (id, hash) => `/engine/packs/pack-${id}.tar.gz?v=${hash}`;

const plan = (cached, defaultPackIds = ["writing", "mnras"]) =>
	planUpdate({ manifest, packs, defaultPackIds, cached });

describe("planUpdate", () => {
	test("a device that never installed the engine gets the first-run flow, not an update", () => {
		assert.equal(plan([]), null);
		assert.equal(plan(["/engine/manifest.json", "/engine/packs-index.json"]), null);
	});

	test("up to date means nothing to do", () => {
		const cached = [...core("v2"), cachedPack("writing", "w1"), cachedPack("mnras", "m1")];
		assert.equal(plan(cached), null);
	});

	test("a new engine build is reported with its exact size", () => {
		const result = plan([...core("v1"), cachedPack("writing", "w1"), cachedPack("mnras", "m1")]);
		assert.equal(result?.coreChanged, true);
		assert.equal(result?.coreBytes, 1000);
		assert.deepEqual(result?.packs, []);
		assert.equal(result?.totalBytes, 1000);
	});

	test("a default pack added since the last install is offered", () => {
		const result = plan([...core("v2"), cachedPack("writing", "w1")]);
		assert.equal(result?.coreChanged, false);
		assert.deepEqual(
			result?.packs.map((p) => p.id),
			["mnras"]
		);
		assert.equal(result?.totalBytes, 30);
	});

	test("a rebuilt pack replaces the older one the device holds", () => {
		const result = plan([...core("v2"), cachedPack("writing", "old"), cachedPack("mnras", "m1")]);
		assert.deepEqual(
			result?.packs.map((p) => p.id),
			["writing"]
		);
	});

	test("an optional pack counts only once the device has it", () => {
		const without = plan([...core("v2"), cachedPack("writing", "w1"), cachedPack("mnras", "m1")]);
		assert.equal(without, null, "icons was never installed, so it is not an update");

		const outdated = plan([
			...core("v2"),
			cachedPack("writing", "w1"),
			cachedPack("mnras", "m1"),
			cachedPack("icons", "older")
		]);
		assert.deepEqual(
			outdated?.packs.map((p) => p.id),
			["icons"]
		);
		assert.equal(outdated?.totalBytes, 500);
	});

	test("the signature changes with the update, so Later is remembered per update", () => {
		const a = plan([...core("v1"), cachedPack("writing", "w1"), cachedPack("mnras", "m1")]);
		const b = plan([...core("v2"), cachedPack("writing", "old"), cachedPack("mnras", "m1")]);
		assert.notEqual(a?.signature, b?.signature);
		assert.equal(
			a?.signature,
			plan([...core("v1"), cachedPack("writing", "w1"), cachedPack("mnras", "m1")])?.signature
		);
	});
});
