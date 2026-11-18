import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context.ts";
import { GIT_PROVIDERS } from "../db/schema.ts";
import { errors } from "../lib/errors.ts";
import { currentUser, requireProject } from "../middleware/index.ts";
import { gitService } from "../services/git.ts";
import { validate } from "./validation.ts";

const provider = z.enum(GIT_PROVIDERS);
const repo = z
	.string()
	.max(200)
	.regex(/^[\w.-]+(?:\/[\w.-]+)+$/, "Use the form owner/name.");
const branch = z
	.string()
	.min(1)
	.max(200)
	.regex(/^[\w./-]+$/)
	.refine((b) => !b.includes("..") && !b.startsWith("/"), "Invalid branch name.");

function providerParam(value: string) {
	const parsed = provider.safeParse(value);
	if (!parsed.success) throw errors.notFound("Git provider");
	return parsed.data;
}

/** Browsing the caller's repositories on a connected host. Connecting itself is Better Auth's job. */
export const gitController = new Hono<AppEnv>()
	.get(
		"/:provider/repos",
		validate("query", z.object({ q: z.string().max(100).optional() })),
		async (c) =>
			c.json({
				repos: await gitService(c.var.deps).repos(
					c.req.raw.headers,
					providerParam(c.req.param("provider")),
					c.req.valid("query").q
				)
			})
	)
	.get("/:provider/branches", validate("query", z.object({ repo })), async (c) =>
		c.json({
			branches: await gitService(c.var.deps).branches(
				c.req.raw.headers,
				providerParam(c.req.param("provider")),
				c.req.valid("query").repo
			)
		})
	);

/** Linking one project to a repository, then pulling from it and pushing to it. */
export const projectGitController = new Hono<AppEnv>()
	.get("/:projectId/git", requireProject("project:read"), async (c) =>
		c.json({ link: await gitService(c.var.deps).getLink(c.var.access) })
	)
	.put(
		"/:projectId/git",
		requireProject("project:share"),
		validate("json", z.object({ provider, repo, branch })),
		async (c) => {
			await gitService(c.var.deps).link(
				c.var.access,
				currentUser(c).id,
				c.req.raw.headers,
				c.req.valid("json")
			);
			return c.body(null, 204);
		}
	)
	.delete("/:projectId/git", requireProject("project:share"), async (c) => {
		await gitService(c.var.deps).unlink(c.var.access);
		return c.body(null, 204);
	})
	.post("/:projectId/git/pull", requireProject("project:write"), async (c) =>
		c.json(await gitService(c.var.deps).pull(c.var.access, currentUser(c).id, c.req.raw.headers))
	)
	.post(
		"/:projectId/git/push",
		requireProject("project:write"),
		validate(
			"json",
			z.object({ message: z.string().max(500).default(""), mode: z.enum(["commit", "pr"]) })
		),
		async (c) =>
			c.json(
				await gitService(c.var.deps).push(
					c.var.access,
					currentUser(c).id,
					c.req.raw.headers,
					c.req.valid("json")
				)
			)
	);
