import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context.ts";
import { errors } from "../lib/errors.ts";
import { withTimeout } from "../lib/resilience.ts";
import { adminService } from "../services/admin.ts";
import { validate } from "./validation.ts";

async function probe(fn: () => Promise<unknown>) {
	const started = Date.now();
	try {
		await withTimeout(3_000, () => fn());
		return { ok: true, ms: Date.now() - started };
	} catch (error) {
		return { ok: false, ms: Date.now() - started, error: (error as Error).message };
	}
}

const days = z.coerce.number().int().min(7).max(180).default(30);

// Decision (product): instance admins are the deployer's team. Access is the Better Auth `admin`
// role, or a verified email listed in ADMIN_EMAILS (so a first deploy needs no manual database step).
export const adminController = new Hono<AppEnv>()
	.use("*", async (c, next) => {
		const { user } = c.var;
		const { adminEmails } = c.var.deps.config;
		const isAdmin =
			user?.role === "admin" ||
			(user?.emailVerified === true && adminEmails.includes(user.email.toLowerCase()));
		// Not 403: a non-admin should not learn that this surface exists.
		if (!isAdmin) throw errors.notFound("Route");
		// An admin account must be reachable by its owner, so the address is verified first.
		if (user && !user.emailVerified && c.var.deps.config.requireEmailVerification) {
			throw errors.emailUnverified("Verify your email address to open the admin area.");
		}
		await next();
	})
	.get("/overview", async (c) => c.json(await adminService(c.var.deps.db).overview()))
	.get("/signups", async (c) =>
		c.json(await adminService(c.var.deps.db).signups(days.parse(c.req.query("days"))))
	)
	.get("/organizations", async (c) => c.json(await adminService(c.var.deps.db).organizations()))
	.get("/audit", async (c) => c.json(await adminService(c.var.deps.db).audit()))
	// Name and slug only: membership, roles and policy stay with the org's own owners.
	.patch(
		"/organizations/:id",
		validate(
			"json",
			z.object({
				name: z.string().trim().min(1).max(120).optional(),
				slug: z
					.string()
					.trim()
					.toLowerCase()
					.regex(
						/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/,
						"Use lowercase letters, numbers and hyphens."
					)
					.optional()
			})
		),
		async (c) => {
			const edit = c.req.valid("json");
			const updated = await adminService(c.var.deps.db).updateOrganization(
				c.req.param("id"),
				edit,
				c.var.user?.id ?? null
			);
			return c.json(updated);
		}
	)
	.get("/health", async (c) => {
		const { db, adapters, config, build } = c.var.deps;
		const [database, cache] = await Promise.all([
			probe(() => db.execute(sql`select 1`)),
			probe(() => adapters.cache.ping())
		]);
		return c.json({
			checks: { database, cache },
			drivers: {
				queue: config.queueDriver ?? "default",
				blobs: config.blobDriver,
				mail: config.mailDriver
			},
			build: {
				version: build?.version ?? "unknown",
				runtime: build?.runtime ?? "node",
				commit: build?.commit ?? null,
				deployedAt: build?.deployedAt ?? null
			},
			emailVerificationRequired: config.requireEmailVerification
		});
	});
