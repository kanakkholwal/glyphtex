import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import { ORG_GUARD, PROJECT_GUARD, session } from "../src/middleware/index.ts";

const app = createApp(() => {
	throw new Error("routes test never handles a request");
});

test("every project-scoped route runs a project guard", () => {
	const scoped = app.routes.filter((r) => r.path.includes(":projectId") && r.method !== "ALL");
	assert.ok(scoped.length > 10, "expected the project routes to be registered");
	const unguarded = new Set<string>();
	const guarded = new Set<string>();
	for (const r of scoped) {
		const id = `${r.method} ${r.path}`;
		if (PROJECT_GUARD in r.handler) guarded.add(id);
		else unguarded.add(id);
	}
	const missing = [...unguarded].filter((id) => !guarded.has(id));
	assert.deepEqual(missing, [], `routes without requireProject(): ${missing.join(", ")}`);
});

test("every org-scoped route runs an org guard", () => {
	const scoped = app.routes.filter((r) => r.path.includes(":orgId") && r.method !== "ALL");
	assert.ok(scoped.length >= 7, "expected the org routes to be registered");
	const guarded = new Set(
		scoped.filter((r) => ORG_GUARD in r.handler).map((r) => `${r.method} ${r.path}`)
	);
	const missing = [...new Set(scoped.map((r) => `${r.method} ${r.path}`))].filter(
		(id) => !guarded.has(id)
	);
	assert.deepEqual(missing, [], `routes without requireOrg(): ${missing.join(", ")}`);
});

test("only health, auth and public config skip the session gate", () => {
	const gate = app.routes.findIndex((r) => r.handler === session);
	assert.ok(gate > 0, "session middleware is mounted");
	const before = app.routes
		.slice(0, gate)
		.filter((r) => r.method !== "ALL")
		.map((r) => r.path);
	assert.deepEqual([...new Set(before)].sort(), [
		"/api/auth/*",
		"/api/public/config",
		"/healthz",
		"/readyz"
	]);
});
