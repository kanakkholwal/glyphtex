import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context.ts";
import { currentUser, requireProject } from "../middleware/index.ts";
import { VERSION_LIMITS, versionService } from "../services/versions.ts";
import { validate } from "./validation.ts";

const name = z.string().trim().min(1).max(VERSION_LIMITS.nameChars);

/** Named snapshots of a project's text. Anyone who can write saves and restores; owners delete. */
export const versionsController = new Hono<AppEnv>()
	.get("/:projectId/versions", requireProject("project:read"), async (c) =>
		c.json({ versions: await versionService(c.var.deps).list(c.var.access) })
	)
	.post(
		"/:projectId/versions",
		requireProject("project:write"),
		validate("json", z.object({ name })),
		async (c) =>
			c.json(
				await versionService(c.var.deps).create(
					c.var.access,
					currentUser(c).id,
					c.req.valid("json").name
				),
				201
			)
	)
	.get("/:projectId/versions/:versionId", requireProject("project:read"), async (c) =>
		c.json({
			files: await versionService(c.var.deps).files(c.var.access, c.req.param("versionId"))
		})
	)
	.get(
		"/:projectId/versions/:versionId/file",
		requireProject("project:read"),
		validate("query", z.object({ path: z.string().min(1).max(512) })),
		async (c) =>
			c.text(
				await versionService(c.var.deps).readFile(
					c.var.access,
					c.req.param("versionId"),
					c.req.valid("query").path
				)
			)
	)
	.patch(
		"/:projectId/versions/:versionId",
		requireProject("project:write"),
		validate("json", z.object({ name })),
		async (c) => {
			await versionService(c.var.deps).rename(
				c.var.access,
				c.req.param("versionId"),
				c.req.valid("json").name
			);
			return c.body(null, 204);
		}
	)
	.post("/:projectId/versions/:versionId/restore", requireProject("project:write"), async (c) =>
		c.json(
			await versionService(c.var.deps).restore(
				c.var.access,
				currentUser(c).id,
				c.req.param("versionId")
			)
		)
	)
	.delete("/:projectId/versions/:versionId", requireProject("project:share"), async (c) => {
		await versionService(c.var.deps).remove(c.var.access, c.req.param("versionId"));
		return c.body(null, 204);
	});
