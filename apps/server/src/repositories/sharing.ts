import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { Db, Tx } from "../db/client.ts";
import { type GrantableRole, projectInvite, projectMember, shareLink, user } from "../db/schema.ts";

export function sharingRepository(db: Db | Tx) {
	return {
		listMembers(projectId: string) {
			return db
				.select({
					userId: projectMember.userId,
					role: projectMember.role,
					name: user.name,
					email: user.email,
					image: user.image,
					since: projectMember.createdAt
				})
				.from(projectMember)
				.innerJoin(user, eq(user.id, projectMember.userId))
				.where(eq(projectMember.projectId, projectId));
		},

		async getMemberRole(projectId: string, userId: string) {
			const [row] = await db
				.select({ role: projectMember.role })
				.from(projectMember)
				.where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
			return row?.role ?? null;
		},

		async upsertMember(projectId: string, userId: string, role: GrantableRole) {
			await db
				.insert(projectMember)
				.values({ projectId, userId, role })
				.onConflictDoUpdate({
					target: [projectMember.projectId, projectMember.userId],
					set: { role }
				});
		},

		async removeMember(projectId: string, userId: string) {
			const rows = await db
				.delete(projectMember)
				.where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
				.returning();
			return rows.length > 0;
		},

		async findUserByEmail(email: string) {
			const [row] = await db.select().from(user).where(eq(user.email, email)).limit(1);
			return row ?? null;
		},

		async upsertInvite(values: typeof projectInvite.$inferInsert) {
			const [row] = await db
				.insert(projectInvite)
				.values(values)
				.onConflictDoUpdate({
					target: [projectInvite.projectId, projectInvite.email],
					set: {
						role: values.role,
						tokenHash: values.tokenHash,
						invitedBy: values.invitedBy,
						expiresAt: values.expiresAt
					}
				})
				.returning();
			return row;
		},

		listInvites(projectId: string) {
			return db
				.select({
					id: projectInvite.id,
					email: projectInvite.email,
					role: projectInvite.role,
					expiresAt: projectInvite.expiresAt
				})
				.from(projectInvite)
				.where(eq(projectInvite.projectId, projectId));
		},

		async findInviteByHash(tokenHash: string) {
			const [row] = await db
				.select()
				.from(projectInvite)
				.where(eq(projectInvite.tokenHash, tokenHash))
				.limit(1);
			return row ?? null;
		},

		async deleteInvite(projectId: string, id: string) {
			const rows = await db
				.delete(projectInvite)
				.where(and(eq(projectInvite.projectId, projectId), eq(projectInvite.id, id)))
				.returning();
			return rows.length > 0;
		},

		async createLink(values: typeof shareLink.$inferInsert) {
			const [row] = await db.insert(shareLink).values(values).returning();
			return row;
		},

		listLinks(projectId: string) {
			return db
				.select({
					id: shareLink.id,
					role: shareLink.role,
					expiresAt: shareLink.expiresAt,
					createdAt: shareLink.createdAt
				})
				.from(shareLink)
				.where(eq(shareLink.projectId, projectId));
		},

		async findActiveLinkByHash(tokenHash: string) {
			const [row] = await db
				.select()
				.from(shareLink)
				.where(
					and(
						eq(shareLink.tokenHash, tokenHash),
						or(isNull(shareLink.expiresAt), gt(shareLink.expiresAt, new Date()))
					)
				)
				.limit(1);
			return row ?? null;
		},

		async deleteLink(projectId: string, id: string) {
			const rows = await db
				.delete(shareLink)
				.where(and(eq(shareLink.projectId, projectId), eq(shareLink.id, id)))
				.returning();
			return rows.length > 0;
		}
	};
}

export type SharingRepository = ReturnType<typeof sharingRepository>;
