import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { AppEnv } from "../context.ts";
import { errors } from "../lib/errors.ts";
import { currentUser, requireProject } from "../middleware/index.ts";
import { archiveService } from "../services/archive.ts";
import { projectService } from "../services/projects.ts";
import { validate } from "./validation.ts";

const name = z.string().trim().min(1).max(200);

export const projectsController = new Hono<AppEnv>()
	.get("/", async (c) => {
		return c.json({ projects: await projectService(c.var.deps).list(currentUser(c).id) });
	})
	.post(
		"/",
		validate("json", z.object({ name, orgId: z.string().min(1).optional() })),
		async (c) => {
			const { name: projectName, orgId } = c.req.valid("json");
			const project = await projectService(c.var.deps).create(
				currentUser(c).id,
				projectName,
				orgId
			);
			return c.json({ project }, 201);
		}
	)
	.post(
		"/import",
		validate("query", z.object({ name, orgId: z.string().min(1).optional() })),
		(c, next) =>
			bodyLimit({
				maxSize: c.var.deps.config.limits.importBytes,
				onError: () => {
					throw errors.tooLarge("The archive is larger than the import limit.");
				}
			})(c, next),
		async (c) => {
			const zip = new Uint8Array(await c.req.arrayBuffer());
			const { name: projectName, orgId } = c.req.valid("query");
			const result = await archiveService(c.var.deps).importZip(
				currentUser(c).id,
				projectName,
				zip,
				orgId
			);
			return c.json(result, 201);
		}
	)
	.get("/:projectId", requireProject("project:read"), (c) =>
		c.json({ project: projectService(c.var.deps).view(c.var.access) })
	)
	.patch(
		"/:projectId",
		requireProject("project:rename"),
		validate(
			"json",
			z
				.object({ name: name.optional(), mainFile: z.string().min(1).max(512).optional() })
				.refine((v) => v.name !== undefined || v.mainFile !== undefined, "Nothing to update.")
		),
		async (c) => {
			const project = await projectService(c.var.deps).update(c.var.access, c.req.valid("json"));
			return c.json({ project });
		}
	)
	.delete("/:projectId", requireProject("project:delete"), async (c) => {
		await projectService(c.var.deps).remove(c.var.access, currentUser(c).id);
		return c.body(null, 204);
	});
