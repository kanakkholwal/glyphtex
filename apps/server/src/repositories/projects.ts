import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { Db, Tx } from "../db/client.ts";
import {
	member,
	orgPolicy,
	type ProjectRole,
	project,
	projectFile,
	projectMember
} from "../db/schema.ts";
import { DEFAULT_POLICY, type Policy, roleFromOrg } from "../rbac/org.ts";
import { strongerRole } from "../rbac/permissions.ts";

export type ProjectRow = typeof project.$inferSelect;

type AccessRow = {
	project: ProjectRow;
	memberRole: ProjectRole | null;
	orgRole: string | null;
	policy: (Policy & { organizationId: string }) | null;
};

function effectiveRole(userId: string, row: AccessRow): ProjectRole | null {
	if (row.project.ownerId === userId) return "owner";
	const fromOrg = row.orgRole ? roleFromOrg(row.orgRole, row.policy ?? DEFAULT_POLICY) : null;
	if (row.memberRole && fromOrg) return strongerRole(row.memberRole, fromOrg);
	return row.memberRole ?? fromOrg;
}

export function projectRepository(db: Db | Tx) {
	return {
		async create(values: typeof project.$inferInsert) {
			const [row] = await db.insert(project).values(values).returning();
			return row as ProjectRow;
		},

		/**
		 * The actor's effective role: the strongest of ownership, a direct share and what their
		 * org role grants on org projects. Null when none applies.
		 */
		async findWithRole(projectId: string, userId: string) {
			const [row] = await db
				.select({
					project,
					memberRole: projectMember.role,
					orgRole: member.role,
					policy: orgPolicy
				})
				.from(project)
				.leftJoin(
					projectMember,
					and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId))
				)
				.leftJoin(
					member,
					and(eq(member.organizationId, project.organizationId), eq(member.userId, userId))
				)
				.leftJoin(orgPolicy, eq(orgPolicy.organizationId, project.organizationId))
				.where(eq(project.id, projectId))
				.limit(1);
			if (!row) return null;
			return { project: row.project, role: effectiveRole(userId, row) };
		},

		/**
		 * Personal space: projects outside any org, plus org projects shared with someone who is
		 * not in that org (an outside collaborator sees them here, not under the org).
		 */
		async listForUser(userId: string) {
			const rows = await db
				.select({ project, memberRole: projectMember.role })
				.from(project)
				.leftJoin(
					projectMember,
					and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId))
				)
				.where(
					and(
						or(eq(project.ownerId, userId), eq(projectMember.userId, userId)),
						or(
							isNull(project.organizationId),
							sql`not exists (select 1 from ${member} where ${member.organizationId} = ${project.organizationId} and ${member.userId} = ${userId})`
						)
					)
				)
				.orderBy(desc(project.updatedAt));
			return rows.map((r) => ({
				...r.project,
				role: (r.project.ownerId === userId ? "owner" : r.memberRole) as ProjectRole
			}));
		},

		/** An org's projects this member can see, each with their effective role. */
		async listForOrg(orgId: string, userId: string) {
			const rows = await db
				.select({
					project,
					memberRole: projectMember.role,
					orgRole: member.role,
					policy: orgPolicy
				})
				.from(project)
				.innerJoin(
					member,
					and(eq(member.organizationId, project.organizationId), eq(member.userId, userId))
				)
				.leftJoin(
					projectMember,
					and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId))
				)
				.leftJoin(orgPolicy, eq(orgPolicy.organizationId, project.organizationId))
				.where(eq(project.organizationId, orgId))
				.orderBy(desc(project.updatedAt));
			return rows.flatMap((r) => {
				const role = effectiveRole(userId, r);
				return role ? [{ ...r.project, role }] : [];
			});
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
