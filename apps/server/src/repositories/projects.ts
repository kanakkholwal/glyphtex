import { and, desc, eq, or, sql } from "drizzle-orm";
import type { Db, Tx } from "../db/client.ts";
import { type ProjectRole, project, projectFile, projectMember } from "../db/schema.ts";

export type ProjectRow = typeof project.$inferSelect;

export function projectRepository(db: Db | Tx) {
	return {
		async create(values: typeof project.$inferInsert) {
			const [row] = await db.insert(project).values(values).returning();
			return row as ProjectRow;
		},

		/** The actor's effective role: owner beats membership; null when they have no access. */
		async findWithRole(projectId: string, userId: string) {
			const [row] = await db
				.select({ project, memberRole: projectMember.role })
				.from(project)
				.leftJoin(
					projectMember,
					and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId))
				)
				.where(eq(project.id, projectId))
				.limit(1);
			if (!row) return null;
			const role: ProjectRole | null =
				row.project.ownerId === userId ? "owner" : (row.memberRole ?? null);
			return { project: row.project, role };
		},

		async listForUser(userId: string) {
			const rows = await db
				.select({ project, memberRole: projectMember.role })
				.from(project)
				.leftJoin(
					projectMember,
					and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId))
				)
				.where(or(eq(project.ownerId, userId), eq(projectMember.userId, userId)))
				.orderBy(desc(project.updatedAt));
			return rows.map((r) => ({
				...r.project,
				role: (r.project.ownerId === userId ? "owner" : r.memberRole) as ProjectRole
			}));
		},

		listOwned(userId: string) {
			return db.select().from(project).where(eq(project.ownerId, userId));
		},

		async update(projectId: string, values: Partial<Pick<ProjectRow, "name" | "mainFile">>) {
			const [row] = await db
				.update(project)
				.set(values)
				.where(eq(project.id, projectId))
				.returning();
			return row ?? null;
		},

		async touch(projectId: string) {
			await db.update(project).set({ updatedAt: sql`now()` }).where(eq(project.id, projectId));
		},

		async delete(projectId: string) {
			await db.delete(project).where(eq(project.id, projectId));
		},

		/** Blob keys that must be purged before rows cascade away. */
		async blobKeysForProjects(projectIds: string[]) {
			if (projectIds.length === 0) return [];
			const rows = await db
				.select({ key: projectFile.blobKey })
				.from(projectFile)
				.where(
					and(
						sql`${projectFile.projectId} in ${projectIds}`,
						sql`${projectFile.blobKey} is not null`
					)
				);
			return rows.map((r) => r.key as string);
		}
	};
}

export type ProjectRepository = ReturnType<typeof projectRepository>;
