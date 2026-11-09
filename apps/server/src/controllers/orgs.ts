import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context.ts";
import { FEATURES, MEMBER_ACCESS } from "../db/schema.ts";
import { normalizePath } from "../lib/paths.ts";
import { currentUser, requireOrg } from "../middleware/index.ts";
import { orgContentService } from "../services/org-content.ts";
import { orgIdentityService } from "../services/org-identity.ts";
import { orgService } from "../services/orgs.ts";
import { validate } from "./validation.ts";

const policyPatch = z
	.object({
		memberAccess: z.enum(MEMBER_ACCESS),
		shareLinks: z.boolean(),
		externalInvites: z.boolean(),
		ai: z.boolean(),
		requireTwoFactor: z.boolean(),
		seatLimit: z.number().int().positive().max(100_000).nullable()
	})
	.partial()
	.refine((v) => Object.keys(v).length > 0, "Nothing to update.");

const templateBody = z.object({
	title: z.string().trim().min(1).max(120),
	description: z.string().trim().max(500).default("")
});
const scimExpiry = z.object({ expiresInDays: z.number().int().min(1).max(730).default(365) });
const nameBody = z.object({ name: z.string().trim().min(1).max(200) });

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
	})
	.get("/:orgId/templates", requireOrg("org:read"), async (c) =>
		c.json({ templates: await orgContentService(c.var.deps).listTemplates(c.var.orgAccess) })
	)
	.put(
		"/:orgId/templates/:templateId",
		requireOrg("org:manage-policy"),
		validate("json", templateBody),
		async (c) => {
			await orgContentService(c.var.deps).saveTemplate(
				c.var.orgAccess,
				currentUser(c).id,
				c.req.param("templateId"),
				c.req.valid("json")
			);
			return c.body(null, 204);
		}
	)
	.delete("/:orgId/templates/:templateId", requireOrg("org:manage-policy"), async (c) => {
		await orgContentService(c.var.deps).removeTemplate(
			c.var.orgAccess,
			currentUser(c).id,
			c.req.param("templateId")
		);
		return c.body(null, 204);
	})
	.post(
		"/:orgId/templates/:templateId/use",
		requireOrg("org:create-project"),
		validate("json", nameBody),
		async (c) =>
			c.json(
				{
					project: await orgContentService(c.var.deps).useTemplate(
						c.var.orgAccess,
						currentUser(c).id,
						c.req.param("templateId"),
						c.req.valid("json").name
					)
				},
				201
			)
	)
	.get("/:orgId/library", requireOrg("org:read"), async (c) =>
		c.json(await orgContentService(c.var.deps).library(c.var.orgAccess))
	)
	.get(
		"/:orgId/library/raw",
		requireOrg("org:read"),
		validate("query", z.object({ path: z.string().min(1).max(512) })),
		async (c) => {
			const blob = await orgContentService(c.var.deps).libraryFile(
				c.var.orgAccess,
				normalizePath(c.req.valid("query").path)
			);
			return c.body(blob.body, 200, {
				"content-type": blob.contentType ?? "application/octet-stream",
				"content-length": String(blob.size),
				"cache-control": "private, no-cache"
			});
		}
	)
	.get("/:orgId/sso", requireOrg("org:manage-policy"), async (c) =>
		c.json({ providers: await orgIdentityService(c.var.deps).sso(c.var.orgAccess) })
	)
	.get("/:orgId/scim", requireOrg("org:manage-policy"), async (c) =>
		c.json(await orgIdentityService(c.var.deps).scim(c.var.orgAccess))
	)
	.post("/:orgId/scim", requireOrg("org:manage-policy"), validate("json", scimExpiry), async (c) =>
		c.json(
			await orgIdentityService(c.var.deps).createScim(
				c.var.orgAccess,
				currentUser(c).id,
				c.req.valid("json").expiresInDays
			),
			201
		)
	)
	.post(
		"/:orgId/scim/:connectionId/rotate",
		requireOrg("org:manage-policy"),
		validate("json", scimExpiry),
		async (c) =>
			c.json(
				await orgIdentityService(c.var.deps).rotateScim(
					c.var.orgAccess,
					currentUser(c).id,
					c.req.param("connectionId"),
					c.req.valid("json").expiresInDays
				)
			)
	)
	.delete("/:orgId/scim/:connectionId", requireOrg("org:manage-policy"), async (c) => {
		await orgIdentityService(c.var.deps).removeScim(
			c.var.orgAccess,
			currentUser(c).id,
			c.req.param("connectionId")
		);
		return c.body(null, 204);
	})
	.post("/:orgId/library", requireOrg("org:manage-policy"), async (c) =>
		c.json(
			{
				projectId: await orgContentService(c.var.deps).ensureLibrary(
					c.var.orgAccess,
					currentUser(c).id
				)
			},
			201
		)
	);
