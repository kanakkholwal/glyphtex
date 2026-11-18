import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { disabledBlobs } from "../src/adapters/blobs/disabled.ts";
import { parseConfig } from "../src/config.ts";
import type { Deps } from "../src/context.ts";
import type { Db } from "../src/db/client.ts";
import * as schema from "../src/db/schema.ts";
import { newId } from "../src/lib/crypto.ts";
import { createLogger } from "../src/lib/logger.ts";
import type { ProjectAccess } from "../src/rbac/authorize.ts";
import type { ProjectRole } from "../src/db/schema.ts";

/**
 * A real Postgres engine (PGlite, WebAssembly) with every migration applied, so service tests
 * exercise the real SQL, constraints and transactions without Docker.
 */
export async function startPg(extraEnv: Record<string, string> = {}) {
	const client = new PGlite();
	const pglite = drizzle(client, { schema });
	await migrate(pglite, {
		migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url))
	});
	// The services only use the query-builder surface both drivers share; the types differ.
	const db = pglite as unknown as Db;

	const config = parseConfig({
		PUBLIC_URL: "http://localhost:8787",
		APP_URL: "http://localhost:5173",
		BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
		...extraEnv
	});

	function deps(overrides: Partial<Deps> = {}): Deps {
		return {
			config,
			db,
			adapters: {
				blobs: disabledBlobs(),
				queue: { enqueue: async () => {} }
			} as unknown as Deps["adapters"],
			auth: {} as Deps["auth"],
			logger: createLogger({}, "error"),
			...overrides
		};
	}

	async function user(name: string) {
		const id = newId();
		await db.insert(schema.user).values({
			id,
			name,
			email: `${name.toLowerCase()}-${id.slice(0, 6)}@example.test`,
			emailVerified: true
		});
		return { id, name };
	}

	/** A project owned by `ownerId`; returns an access object for any role, as the route guard would build one. */
	async function project(ownerId: string, name = "Thesis") {
		const id = newId();
		const [row] = await db.insert(schema.project).values({ id, name, ownerId }).returning();
		const access = (role: ProjectRole = "owner"): ProjectAccess => ({
			project: row as ProjectAccess["project"],
			role
		});
		return { id, row, access };
	}

	async function textFile(projectId: string, path: string, content: string) {
		const { sha256Hex } = await import("../src/lib/crypto.ts");
		await db.insert(schema.projectFile).values({
			projectId,
			path,
			kind: "text",
			content,
			size: new TextEncoder().encode(content).length,
			sha256: await sha256Hex(content),
			version: 1
		});
	}

	return { db, deps, config, user, project, textFile, close: () => client.close() };
}
