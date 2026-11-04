import { and, count, desc, eq, gt, inArray, lt, sql, sum } from "drizzle-orm";
import type { Db, Tx } from "../db/client.ts";
import {
	auditEvent,
	type Feature,
	member,
	memberFeature,
	organization,
	orgPolicy,
	project,
	projectFile,
	session,
	user
} from "../db/schema.ts";
import { newId } from "../lib/crypto.ts";
import { DEFAULT_POLICY, type Policy } from "../rbac/org.ts";

export type AuditInput = {
	organizationId: string;
	actorId: string | null;
	action: string;
	targetType: string;
	targetId?: string | null;
	meta?: Record<string, string | number | boolean | null>;
};

export function orgRepository(db: Db | Tx) {
	return {
		async get(orgId: string) {
			const [row] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1);
			return row ?? null;
		},

		async membership(orgId: string, userId: string) {
			const [row] = await db
				.select({ role: member.role })
				.from(member)
				.where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
				.limit(1);
			return row?.role ?? null;
		},

		async isMemberByEmail(orgId: string, email: string) {
			const [row] = await db
				.select({ id: member.id })
				.from(member)
				.innerJoin(user, eq(user.id, member.userId))
				.where(and(eq(member.organizationId, orgId), eq(user.email, email.toLowerCase())))
				.limit(1);
			return Boolean(row);
		},

		async policy(orgId: string): Promise<Policy> {
			const [row] = await db
				.select()
				.from(orgPolicy)
				.where(eq(orgPolicy.organizationId, orgId))
				.limit(1);
			if (!row) return { ...DEFAULT_POLICY };
			const { organizationId: _, updatedAt: __, ...policy } = row;
			return policy;
		},

		async savePolicy(orgId: string, patch: Partial<Policy>) {
			const next = { ...(await this.policy(orgId)), ...patch };
			await db
				.insert(orgPolicy)
				.values({ organizationId: orgId, ...next })
				.onConflictDoUpdate({ target: orgPolicy.organizationId, set: next });
			return next;
		},

		overrides(orgId: string, userId: string) {
			return db
				.select({ feature: memberFeature.feature, enabled: memberFeature.enabled })
				.from(memberFeature)
				.where(and(eq(memberFeature.organizationId, orgId), eq(memberFeature.userId, userId)));
		},

		/** `enabled: null` removes the override, so the org default applies again. */
		async setOverride(orgId: string, userId: string, feature: Feature, enabled: boolean | null) {
			const key = and(
				eq(memberFeature.organizationId, orgId),
				eq(memberFeature.userId, userId),
				eq(memberFeature.feature, feature)
			);
			if (enabled === null) {
				await db.delete(memberFeature).where(key);
				return;
			}
			await db
				.insert(memberFeature)
				.values({ organizationId: orgId, userId, feature, enabled })
				.onConflictDoUpdate({
					target: [memberFeature.organizationId, memberFeature.userId, memberFeature.feature],
					set: { enabled }
				});
		},

		listProjects(orgId: string) {
			return db
				.select()
				.from(project)
				.where(eq(project.organizationId, orgId))
				.orderBy(desc(project.updatedAt));
		},

		async blobKeys(orgId: string) {
			const rows = await db
				.select({ key: projectFile.blobKey })
				.from(projectFile)
				.innerJoin(project, eq(project.id, projectFile.projectId))
				.where(and(eq(project.organizationId, orgId), sql`${projectFile.blobKey} is not null`));
			return rows.map((r) => r.key as string);
		},

		/** Orgs where this user is an owner, with how many owners and members each has. */
		async ownedOrgs(userId: string) {
			const mine = await db
				.select({ orgId: member.organizationId })
				.from(member)
				.where(and(eq(member.userId, userId), eq(member.role, "owner")));
			if (!mine.length) return [];
			const ids = mine.map((m) => m.orgId);
			return db
				.select({
					orgId: member.organizationId,
					name: organization.name,
					owners: sql<number>`count(*) filter (where ${member.role} = 'owner')`.mapWith(Number),
					members: count()
				})
				.from(member)
				.innerJoin(organization, eq(organization.id, member.organizationId))
				.where(inArray(member.organizationId, ids))
				.groupBy(member.organizationId, organization.name);
		},

		async deleteOrg(orgId: string) {
			await db.delete(organization).where(eq(organization.id, orgId));
		},

		async stats(orgId: string) {
			const since = new Date(Date.now() - 30 * 86_400_000);
			const week = new Date(Date.now() - 7 * 86_400_000);
			const [[members], [projects], [storage], [active], [edited]] = await Promise.all([
				db.select({ n: count() }).from(member).where(eq(member.organizationId, orgId)),
				db.select({ n: count() }).from(project).where(eq(project.organizationId, orgId)),
				db
					.select({ bytes: sum(projectFile.size).mapWith(Number) })
					.from(projectFile)
					.innerJoin(project, eq(project.id, projectFile.projectId))
					.where(eq(project.organizationId, orgId)),
				db
					.select({ n: sql<number>`count(distinct ${session.userId})`.mapWith(Number) })
					.from(session)
					.innerJoin(member, eq(member.userId, session.userId))
					.where(and(eq(member.organizationId, orgId), gt(session.updatedAt, since))),
				db
					.select({ n: count() })
					.from(project)
					.where(and(eq(project.organizationId, orgId), gt(project.updatedAt, week)))
			]);
			return {
				members: members?.n ?? 0,
				projects: projects?.n ?? 0,
				storageBytes: storage?.bytes ?? 0,
				activeMembers30d: active?.n ?? 0,
				projectsEdited7d: edited?.n ?? 0
			};
		},

		async audit(input: AuditInput) {
			await db.insert(auditEvent).values({ id: newId(), ...input, meta: input.meta ?? null });
		},

		listAudit(orgId: string, before: Date | undefined, limit: number) {
			return db
				.select({
					id: auditEvent.id,
					action: auditEvent.action,
					targetType: auditEvent.targetType,
					targetId: auditEvent.targetId,
					meta: auditEvent.meta,
					createdAt: auditEvent.createdAt,
					actorId: auditEvent.actorId,
					actorName: user.name,
					actorEmail: user.email
				})
				.from(auditEvent)
				.leftJoin(user, eq(user.id, auditEvent.actorId))
				.where(
					and(
						eq(auditEvent.organizationId, orgId),
						before ? lt(auditEvent.createdAt, before) : undefined
					)
				)
				.orderBy(desc(auditEvent.createdAt))
				.limit(limit);
		},

		async pruneAudit(retentionDays: number) {
			const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
			const rows = await db.delete(auditEvent).where(lt(auditEvent.createdAt, cutoff)).returning({
				id: auditEvent.id
			});
			return rows.length;
		}
	};
}

export type OrgRepository = ReturnType<typeof orgRepository>;
