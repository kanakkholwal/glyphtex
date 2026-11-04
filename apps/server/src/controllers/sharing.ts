import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context.ts";
import { GRANTABLE_ROLES } from "../db/schema.ts";
import { currentUser, rateLimit, requireProject } from "../middleware/index.ts";
import { can } from "../rbac/permissions.ts";
import { sharingService } from "../services/sharing.ts";
import { validate } from "./validation.ts";

const role = z.enum(GRANTABLE_ROLES);
const token = z.object({ token: z.string().min(20).max(200) });

/** Routes under /api/projects/:projectId; every one is guarded. */
export const projectSharingController = new Hono<AppEnv>()
	.get("/:projectId/members", requireProject("project:read"), async (c) =>
		c.json(await sharingService(c.var.deps).members(c.var.access))
	)
	.patch(
		"/:projectId/members/:userId",
		requireProject("project:share"),
		validate("json", z.object({ role })),
		async (c) => {
			await sharingService(c.var.deps).setRole(
				c.var.access,
				c.req.param("userId"),
				c.req.valid("json").role
			);
			return c.body(null, 204);
		}
	)
	.delete("/:projectId/members/:userId", requireProject("project:read"), async (c) => {
		await sharingService(c.var.deps).removeMember(
			c.var.access,
			currentUser(c).id,
			c.req.param("userId"),
			can(c.var.access.role, "project:share")
		);
		return c.body(null, 204);
	})
	.get("/:projectId/invites", requireProject("project:share"), async (c) =>
		c.json({ invites: await sharingService(c.var.deps).listInvites(c.var.access) })
	)
	.post(
		"/:projectId/invites",
		requireProject("project:share"),
		rateLimit("share"),
		validate("json", z.object({ email: z.email(), role })),
		async (c) => {
			const { email, role: r } = c.req.valid("json");
			const invite = await sharingService(c.var.deps).invite(
				c.var.access,
				currentUser(c),
				email,
				r
			);
			return c.json({ invite }, 201);
		}
	)
	.delete("/:projectId/invites/:inviteId", requireProject("project:share"), async (c) => {
		await sharingService(c.var.deps).revokeInvite(c.var.access, c.req.param("inviteId"));
		return c.body(null, 204);
	})
	.get("/:projectId/links", requireProject("project:share"), async (c) =>
		c.json({ links: await sharingService(c.var.deps).listLinks(c.var.access) })
	)
	.post(
		"/:projectId/links",
		requireProject("project:share"),
		validate(
			"json",
			z.object({
				role,
				expiresInHours: z
					.number()
					.int()
					.positive()
					.max(24 * 365)
					.optional()
			})
		),
		async (c) => {
			const { role: r, expiresInHours } = c.req.valid("json");
			const link = await sharingService(c.var.deps).createLink(
				c.var.access,
				currentUser(c).id,
				r,
				expiresInHours
			);
			return c.json({ link }, 201);
		}
	)
	.delete("/:projectId/links/:linkId", requireProject("project:share"), async (c) => {
		await sharingService(c.var.deps).revokeLink(c.var.access, c.req.param("linkId"));
		return c.body(null, 204);
	});

/** Token redemption: the token is the authorization, rate-limited against guessing. */
export const redeemController = new Hono<AppEnv>()
	.post("/invites/accept", rateLimit("share"), validate("json", token), async (c) =>
		c.json(await sharingService(c.var.deps).acceptInvite(currentUser(c), c.req.valid("json").token))
	)
	.post("/links/redeem", rateLimit("share"), validate("json", token), async (c) =>
		c.json(
			await sharingService(c.var.deps).redeemLink(currentUser(c).id, c.req.valid("json").token)
		)
	);
