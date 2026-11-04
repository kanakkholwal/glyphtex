import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import { PROJECT_GUARD } from "../src/middleware/index.ts";

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

test("only health and auth endpoints skip the session gate", () => {
	const publicPaths = app.routes
		.filter((r) => r.method !== "ALL" && !r.path.startsWith("/api/"))
		.map((r) => r.path);
	assert.deepEqual([...new Set(publicPaths)].sort(), ["/healthz", "/readyz"]);
});
