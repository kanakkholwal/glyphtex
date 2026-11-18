import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context.ts";
import { currentUser, requireProject } from "../middleware/index.ts";
import { REVIEW_LIMITS, reviewService } from "../services/review.ts";
import { validate } from "./validation.ts";

const path = z.string().min(1).max(512);
const body = z.string().trim().min(1).max(REVIEW_LIMITS.body);
const offset = z.number().int().min(0).max(50_000_000);

/** Comments and suggestions on a project's text. Commenters may write both; accepting needs write access. */
export const reviewController = new Hono<AppEnv>()
	.get(
		"/:projectId/comments",
		requireProject("project:read"),
		validate("query", z.object({ path: path.optional() })),
		async (c) =>
			c.json({
				comments: await reviewService(c.var.deps).listComments(
					c.var.access,
					c.req.valid("query").path
				)
			})
	)
	.post(
		"/:projectId/comments",
		requireProject("project:comment"),
		validate(
			"json",
			z.object({
				path,
				body,
				parentId: z.string().max(64).optional(),
				quote: z.string().max(REVIEW_LIMITS.quote).optional(),
				from: offset.optional(),
				to: offset.optional()
			})
		),
		async (c) =>
			c.json(
				{
					comment: await reviewService(c.var.deps).createComment(
						c.var.access,
						currentUser(c).id,
						c.req.valid("json")
					)
				},
				201
			)
	)
	.patch(
		"/:projectId/comments/:commentId",
		requireProject("project:comment"),
		validate("json", z.object({ body: body.optional(), resolved: z.boolean().optional() })),
		async (c) => {
			const service = reviewService(c.var.deps);
			const { body: text, resolved } = c.req.valid("json");
			const id = c.req.param("commentId");
			const userId = currentUser(c).id;
			let comment: unknown;
			if (text !== undefined) comment = await service.editComment(c.var.access, userId, id, text);
			if (resolved !== undefined) {
				comment = await service.setResolved(c.var.access, userId, id, resolved);
			}
			return c.json({ comment });
		}
	)
	.delete("/:projectId/comments/:commentId", requireProject("project:comment"), async (c) => {
		await reviewService(c.var.deps).deleteComment(
			c.var.access,
			currentUser(c).id,
			c.req.param("commentId")
		);
		return c.body(null, 204);
	})
	.get(
		"/:projectId/suggestions",
		requireProject("project:read"),
		validate(
			"query",
			z.object({
				path: path.optional(),
				status: z.enum(["pending", "accepted", "rejected"]).optional()
			})
		),
		async (c) =>
			c.json({
				suggestions: await reviewService(c.var.deps).listSuggestions(
					c.var.access,
					c.req.valid("query")
				)
			})
	)
	.post(
		"/:projectId/suggestions",
		requireProject("project:comment"),
		validate(
			"json",
			z.object({
				path,
				quote: z.string().max(REVIEW_LIMITS.quote),
				replacement: z.string().max(REVIEW_LIMITS.quote),
				from: offset,
				to: offset
			})
		),
		async (c) =>
			c.json(
				{
					suggestion: await reviewService(c.var.deps).createSuggestion(
						c.var.access,
						currentUser(c).id,
						c.req.valid("json")
					)
				},
				201
			)
	)
	.post(
		"/:projectId/suggestions/:suggestionId/decision",
		requireProject("project:write"),
		validate("json", z.object({ status: z.enum(["accepted", "rejected"]) })),
		async (c) =>
			c.json({
				suggestion: await reviewService(c.var.deps).decide(
					c.var.access,
					currentUser(c).id,
					c.req.param("suggestionId"),
					c.req.valid("json").status
				)
			})
	)
	.delete("/:projectId/suggestions/:suggestionId", requireProject("project:comment"), async (c) => {
		await reviewService(c.var.deps).withdraw(
			c.var.access,
			currentUser(c).id,
			c.req.param("suggestionId")
		);
		return c.body(null, 204);
	});
