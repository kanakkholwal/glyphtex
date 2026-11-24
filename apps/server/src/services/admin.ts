import { count, desc, eq, sql, sum } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { errors } from "../lib/errors.ts";
import { orgRepository } from "../repositories/orgs.ts";
import {
	auditEvent,
	invitation,
	member,
	organization,
	project,
	projectFile,
	session,
	ssoProvider,
	user
} from "../db/schema.ts";

const DAY_MS = 86_400_000;
// ISO text with an explicit cast: a Date bound inside a raw `sql` fragment is not serialised by the driver.
const since = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

/** Instance-wide numbers for the admin dashboard. Everything is a count over existing tables. */
export function adminService(db: Db) {
	const one = async <T>(rows: Promise<T[]>) => (await rows)[0] as T;
	const n = (value: unknown) => Number(value ?? 0);

	return {
		async overview() {
			const [users, activity, orgs, projects, storage] = await Promise.all([
				one(
					db
						.select({
							total: count(),
							verified: sql<number>`count(*) filter (where ${user.emailVerified})`,
							banned: sql<number>`count(*) filter (where ${user.banned})`,
							admins: sql<number>`count(*) filter (where ${user.role} = 'admin')`,
							twoFactor: sql<number>`count(*) filter (where ${user.twoFactorEnabled})`,
							new7: sql<number>`count(*) filter (where ${user.createdAt} > ${since(7)}::timestamptz)`,
							new30: sql<number>`count(*) filter (where ${user.createdAt} > ${since(30)}::timestamptz)`
						})
						.from(user)
				),
				one(
					db
						.select({
							active7: sql<number>`count(distinct ${session.userId}) filter (where ${session.updatedAt} > ${since(7)}::timestamptz)`,
							active30: sql<number>`count(distinct ${session.userId}) filter (where ${session.updatedAt} > ${since(30)}::timestamptz)`,
							sessions: count()
						})
						.from(session)
				),
				Promise.all([
					one(db.select({ n: count() }).from(organization)),
					one(db.select({ n: count() }).from(member)),
					one(db.select({ n: count() }).from(invitation).where(eq(invitation.status, "pending"))),
					one(db.select({ n: count() }).from(ssoProvider))
				]),
				one(
					db
						.select({
							total: count(),
							inOrgs: sql<number>`count(*) filter (where ${project.organizationId} is not null)`
						})
						.from(project)
				),
				one(
					db
						.select({
							files: count(),
							bytes: sum(projectFile.size),
							binaryBytes: sql<number>`coalesce(sum(${projectFile.size}) filter (where ${projectFile.kind} = 'binary'), 0)`
						})
						.from(projectFile)
				)
			]);
			const [orgCount, members, pendingInvites, sso] = orgs;
			return {
				users: {
					total: n(users.total),
					verified: n(users.verified),
					banned: n(users.banned),
					admins: n(users.admins),
					twoFactor: n(users.twoFactor),
					new7: n(users.new7),
					new30: n(users.new30),
					active7: n(activity.active7),
					active30: n(activity.active30),
					sessions: n(activity.sessions)
				},
				organizations: {
					total: n(orgCount.n),
					members: n(members.n),
					pendingInvites: n(pendingInvites.n),
					ssoProviders: n(sso.n)
				},
				projects: { total: n(projects.total), inOrgs: n(projects.inOrgs) },
				storage: {
					files: n(storage.files),
					bytes: n(storage.bytes),
					binaryBytes: n(storage.binaryBytes)
				}
			};
		},

		/** Signups per day, oldest first, with empty days filled in so a chart has no gaps. */
		async signups(days: number) {
			const rows = await db
				.select({
					day: sql<string>`to_char(date_trunc('day', ${user.createdAt}), 'YYYY-MM-DD')`,
					n: count()
				})
				.from(user)
				.where(sql`${user.createdAt} > ${since(days)}::timestamptz`)
				.groupBy(sql`1`);
			const byDay = new Map(rows.map((r) => [r.day, n(r.n)]));
			return Array.from({ length: days }, (_, i) => {
				const day = new Date(Date.now() - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10);
				return { day, count: byDay.get(day) ?? 0 };
			});
		},

		async organizations(limit = 100) {
			const rows = await db
				.select({
					id: organization.id,
					name: organization.name,
					slug: organization.slug,
					createdAt: organization.createdAt,
					members: sql<number>`(select count(*) from ${member} where ${member.organizationId} = ${organization.id})`,
					projects: sql<number>`(select count(*) from ${project} where ${project.organizationId} = ${organization.id})`,
					bytes: sql<number>`coalesce((select sum(${projectFile.size}) from ${projectFile} join ${project} on ${project.id} = ${projectFile.projectId} where ${project.organizationId} = ${organization.id}), 0)`,
					sso: sql<boolean>`exists (select 1 from ${ssoProvider} where ${ssoProvider.organizationId} = ${organization.id})`
				})
				.from(organization)
				.orderBy(desc(organization.createdAt))
				.limit(limit);
			return rows.map((r) => ({
				...r,
				createdAt: r.createdAt.toISOString(),
				members: n(r.members),
				projects: n(r.projects),
				bytes: n(r.bytes)
			}));
		},

		async updateOrganization(
			id: string,
			edit: { name?: string; slug?: string },
			actorId: string | null
		) {
			if (!edit.name && !edit.slug) throw errors.badRequest("Nothing to change.");
			const [clash] = edit.slug
				? await db
						.select({ id: organization.id })
						.from(organization)
						.where(eq(organization.slug, edit.slug))
						.limit(1)
				: [];
			if (clash && clash.id !== id) throw errors.conflict("That slug is already taken.");
			const [row] = await db
				.update(organization)
				.set({ ...(edit.name && { name: edit.name }), ...(edit.slug && { slug: edit.slug }) })
				.where(eq(organization.id, id))
				.returning({ id: organization.id, name: organization.name, slug: organization.slug });
			if (!row) throw errors.notFound("Organization");
			await orgRepository(db).audit({
				organizationId: id,
				actorId,
				action: "org.updated_by_instance_admin",
				targetType: "organization",
				targetId: id,
				meta: { ...(edit.name && { name: edit.name }), ...(edit.slug && { slug: edit.slug }) }
			});
			return row;
		},

		/** The newest organization audit events across the whole instance. */
		async audit(limit = 50) {
			const rows = await db
				.select({
					id: auditEvent.id,
					action: auditEvent.action,
					targetType: auditEvent.targetType,
					createdAt: auditEvent.createdAt,
					organization: organization.name,
					actor: user.email
				})
				.from(auditEvent)
				.innerJoin(organization, eq(organization.id, auditEvent.organizationId))
				.leftJoin(user, eq(user.id, auditEvent.actorId))
				.orderBy(desc(auditEvent.createdAt))
				.limit(limit);
			return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
		}
	};
}
