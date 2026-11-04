import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../context.ts";
import { withTimeout } from "../lib/resilience.ts";

async function probe(fn: () => Promise<unknown>) {
	const started = Date.now();
	try {
		await withTimeout(3_000, () => fn());
		return { ok: true, ms: Date.now() - started };
	} catch (error) {
		return { ok: false, ms: Date.now() - started, error: (error as Error).message };
	}
}

export const healthController = new Hono<AppEnv>()
	.get("/healthz", (c) => c.json({ status: "ok" }))
	.get("/readyz", async (c) => {
		const { db, adapters } = c.var.deps;
		const [database, cache] = await Promise.all([
			probe(() => db.execute(sql`select 1`)),
			probe(() => adapters.cache.ping())
		]);
		const ready = database.ok && cache.ok;
		return c.json(
			{ status: ready ? "ok" : "degraded", checks: { database, cache } },
			ready ? 200 : 503
		);
	});
