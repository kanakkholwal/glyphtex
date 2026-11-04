import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context.ts";
import { FEATURES, MEMBER_ACCESS } from "../db/schema.ts";
import { currentUser, requireOrg } from "../middleware/index.ts";
import { orgService } from "../services/orgs.ts";
import { validate } from "./validation.ts";

const policyPatch = z
	.object({
		memberAccess: z.enum(MEMBER_ACCESS),
		shareLinks: z.boolean(),
		externalInvites: z.boolean(),
		ai: z.boolean(),
		seatLimit: z.number().int().positive().max(100_000).nullable()
	})
	.partial()
	.refine((v) => Object.keys(v).length > 0, "Nothing to update.");

/** Routes under /api/orgs/:orgId; every one is guarded. Membership itself is Better Auth's. */
export const orgsController = new Hono<AppEnv>()
	.get("/:orgId", requireOrg("org:read"), async (c) =>
		c.json(await orgService(c.var.deps).view(c.var.orgAccess, currentUser(c).id))
	)
	.get("/:orgId/projects", requireOrg("org:read"), async (c) =>
		c.json({ projects: await orgService(c.var.deps).projects(c.var.orgAccess, currentUser(c).id) })
	)
	.patch(
		"/:orgId/policy",
		requireOrg("org:manage-policy"),
		validate("json", policyPatch),
		async (c) =>
			c.json({
				policy: await orgService(c.var.deps).updatePolicy(
					c.var.orgAccess,
					currentUser(c).id,
					c.req.valid("json")
				)
			})
	)
	.get("/:orgId/members/:userId/features", requireOrg("org:manage-members"), async (c) =>
		c.json(await orgService(c.var.deps).memberFeatures(c.var.orgAccess, c.req.param("userId")))
	)
	.put(
		"/:orgId/members/:userId/features",
		requireOrg("org:manage-members"),
		validate("json", z.object({ feature: z.enum(FEATURES), enabled: z.boolean().nullable() })),
		async (c) => {
			const { feature, enabled } = c.req.valid("json");
			return c.json(
				await orgService(c.var.deps).setMemberFeature(
					c.var.orgAccess,
					currentUser(c).id,
					c.req.param("userId"),
					feature,
					enabled
				)
			);
		}
	)
	.get("/:orgId/stats", requireOrg("org:read-audit"), async (c) =>
		c.json({ stats: await orgService(c.var.deps).stats(c.var.orgAccess) })
	)
	.get(
		"/:orgId/audit",
		requireOrg("org:read-audit"),
		validate(
			"query",
			z.object({
				before: z.iso.datetime().optional(),
				limit: z.coerce.number().int().min(1).max(200).default(50)
			})
		),
		async (c) => {
			const { before, limit } = c.req.valid("query");
			const events = await orgService(c.var.deps).audit(
				c.var.orgAccess,
				before ? new Date(before) : undefined,
				limit
			);
			return c.json({ events, next: events.length === limit ? events.at(-1)?.createdAt : null });
		}
	)
	.get("/:orgId/audit.csv", requireOrg("org:read-audit"), async (c) => {
		const csv = await orgService(c.var.deps).auditCsv(c.var.orgAccess);
		const date = new Date().toISOString().slice(0, 10);
		return c.body(csv, 200, {
			"content-type": "text/csv; charset=utf-8",
			"content-disposition": `attachment; filename="glyphtex-audit-${date}.csv"`,
			"cache-control": "no-store"
		});
	});
