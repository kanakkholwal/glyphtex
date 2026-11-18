import { and, asc, desc, eq, or } from "drizzle-orm";
import type { Deps } from "../context.ts";
import { projectComment, projectSuggestion, user } from "../db/schema.ts";
import { newId } from "../lib/crypto.ts";
import { errors } from "../lib/errors.ts";
import { normalizePath } from "../lib/paths.ts";
import type { ProjectAccess } from "../rbac/authorize.ts";
import { can } from "../rbac/permissions.ts";

export const REVIEW_LIMITS = { body: 4000, quote: 20_000 } as const;

const author = { authorName: user.name, authorImage: user.image };

export function reviewService({ db }: Deps) {
	async function comment(projectId: string, id: string) {
		const [row] = await db
			.select()
			.from(projectComment)
			.where(and(eq(projectComment.projectId, projectId), eq(projectComment.id, id)));
		if (!row) throw errors.notFound("Comment");
		return row;
	}

	async function suggestion(projectId: string, id: string) {
		const [row] = await db
			.select()
			.from(projectSuggestion)
			.where(and(eq(projectSuggestion.projectId, projectId), eq(projectSuggestion.id, id)));
		if (!row) throw errors.notFound("Suggestion");
		return row;
	}

	return {
		async listComments({ project }: ProjectAccess, path?: string) {
			const where = path
				? and(
						eq(projectComment.projectId, project.id),
						eq(projectComment.path, normalizePath(path))
					)
				: eq(projectComment.projectId, project.id);
			return db
				.select({
					id: projectComment.id,
					path: projectComment.path,
					parentId: projectComment.parentId,
					authorId: projectComment.authorId,
					body: projectComment.body,
					quote: projectComment.quote,
					anchorFrom: projectComment.anchorFrom,
					anchorTo: projectComment.anchorTo,
					resolvedAt: projectComment.resolvedAt,
					createdAt: projectComment.createdAt,
					...author
				})
				.from(projectComment)
				.innerJoin(user, eq(user.id, projectComment.authorId))
				.where(where)
				.orderBy(asc(projectComment.createdAt));
		},

		async createComment(
			{ project }: ProjectAccess,
			userId: string,
			input: {
				path: string;
				body: string;
				parentId?: string;
				quote?: string;
				from?: number;
				to?: number;
			}
		) {
			let path = normalizePath(input.path);
			if (input.parentId) {
				const parent = await comment(project.id, input.parentId);
				if (parent.parentId) throw errors.badRequest("Reply to the first comment of a thread.");
				path = parent.path;
			}
			const [row] = await db
				.insert(projectComment)
				.values({
					id: newId(),
					projectId: project.id,
					path,
					parentId: input.parentId ?? null,
					authorId: userId,
					body: input.body,
					quote: input.parentId ? null : (input.quote ?? null),
					anchorFrom: input.parentId ? null : (input.from ?? null),
					anchorTo: input.parentId ? null : (input.to ?? null)
				})
				.returning();
			return row;
		},

		async editComment({ project }: ProjectAccess, userId: string, id: string, body: string) {
			const row = await comment(project.id, id);
			if (row.authorId !== userId) throw errors.forbidden("Only the author can edit a comment.");
			const [updated] = await db
				.update(projectComment)
				.set({ body })
				.where(eq(projectComment.id, id))
				.returning();
			return updated;
		},

		/** Resolving closes the whole thread; the author or anyone who can write may do it. */
		async setResolved(access: ProjectAccess, userId: string, id: string, resolved: boolean) {
			const row = await comment(access.project.id, id);
			if (row.parentId) throw errors.badRequest("Resolve the thread, not a reply.");
			if (row.authorId !== userId && !can(access.role, "project:write")) throw errors.forbidden();
			const [updated] = await db
				.update(projectComment)
				.set({ resolvedAt: resolved ? new Date() : null, resolvedBy: resolved ? userId : null })
				.where(eq(projectComment.id, id))
				.returning();
			return updated;
		},

		/** The author removes their own comment; an owner can remove any. A first comment takes its replies. */
		async deleteComment(access: ProjectAccess, userId: string, id: string) {
			const row = await comment(access.project.id, id);
			if (row.authorId !== userId && !can(access.role, "project:share")) throw errors.forbidden();
			await db
				.delete(projectComment)
				.where(or(eq(projectComment.id, id), eq(projectComment.parentId, id)));
		},

		async listSuggestions(
			{ project }: ProjectAccess,
			filter: { path?: string; status?: "pending" | "accepted" | "rejected" }
		) {
			const conds = [eq(projectSuggestion.projectId, project.id)];
			if (filter.path) conds.push(eq(projectSuggestion.path, normalizePath(filter.path)));
			if (filter.status) conds.push(eq(projectSuggestion.status, filter.status));
			return db
				.select({
					id: projectSuggestion.id,
					path: projectSuggestion.path,
					authorId: projectSuggestion.authorId,
					quote: projectSuggestion.quote,
					replacement: projectSuggestion.replacement,
					anchorFrom: projectSuggestion.anchorFrom,
					anchorTo: projectSuggestion.anchorTo,
					status: projectSuggestion.status,
					decidedAt: projectSuggestion.decidedAt,
					createdAt: projectSuggestion.createdAt,
					...author
				})
				.from(projectSuggestion)
				.innerJoin(user, eq(user.id, projectSuggestion.authorId))
				.where(and(...conds))
				.orderBy(desc(projectSuggestion.createdAt));
		},

		async createSuggestion(
			{ project }: ProjectAccess,
			userId: string,
			input: { path: string; quote: string; replacement: string; from: number; to: number }
		) {
			if (input.to < input.from) throw errors.badRequest("The range is backwards.");
			if (input.quote === input.replacement) throw errors.badRequest("Nothing would change.");
			const [row] = await db
				.insert(projectSuggestion)
				.values({
					id: newId(),
					projectId: project.id,
					path: normalizePath(input.path),
					authorId: userId,
					quote: input.quote,
					replacement: input.replacement,
					anchorFrom: input.from,
					anchorTo: input.to
				})
				.returning();
			return row;
		},

		/**
		 * Records the decision only. The editor applies an accepted change to its own text first, so
		 * the browser copy, live rooms and the saved file stay one history.
		 */
		async decide(
			access: ProjectAccess,
			userId: string,
			id: string,
			status: "accepted" | "rejected"
		) {
			const row = await suggestion(access.project.id, id);
			if (row.status !== "pending") throw errors.conflict("This suggestion was already decided.");
			const [updated] = await db
				.update(projectSuggestion)
				.set({ status, decidedBy: userId, decidedAt: new Date() })
				.where(and(eq(projectSuggestion.id, id), eq(projectSuggestion.status, "pending")))
				.returning();
			if (!updated) throw errors.conflict("This suggestion was already decided.");
			return updated;
		},

		async withdraw({ project }: ProjectAccess, userId: string, id: string) {
			const row = await suggestion(project.id, id);
			if (row.authorId !== userId) throw errors.forbidden("Only the author can withdraw it.");
			if (row.status !== "pending") {
				throw errors.conflict("Only pending suggestions can be withdrawn.");
			}
			await db.delete(projectSuggestion).where(eq(projectSuggestion.id, id));
		}
	};
}

export type ReviewService = ReturnType<typeof reviewService>;
