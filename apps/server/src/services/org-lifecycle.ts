import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import type { Queue } from "../adapters/types.ts";
import type { Db } from "../db/client.ts";
import { member, project } from "../db/schema.ts";
import { errors } from "../lib/errors.ts";
import { orgRepository } from "../repositories/orgs.ts";
import { projectRepository } from "../repositories/projects.ts";

// Long enough for the delete to commit; the purge job skips any key still referenced.
export const PURGE_DELAY_SECONDS = 300;

/**
 * Org projects belong to the org: when their creator leaves, ownership moves to an org owner
 * (or admin) instead of the project cascading away with the person.
 */
export async function transferOrgProjects(db: Db, orgId: string, fromUserId: string) {
	const heirs = await db
		.select({ userId: member.userId, role: member.role })
		.from(member)
		.where(
			and(
				eq(member.organizationId, orgId),
				ne(member.userId, fromUserId),
				inArray(member.role, ["owner", "admin"])
			)
		);
	const heir = heirs.find((h) => h.role === "owner") ?? heirs[0];
	if (!heir) return 0;
	const moved = await db
		.update(project)
		.set({ ownerId: heir.userId })
		.where(and(eq(project.organizationId, orgId), eq(project.ownerId, fromUserId)))
		.returning({ id: project.id });
	return moved.length;
}

/** Refuses deletion while the user is the last owner of an org that others still use. */
export async function assertCanDeleteAccount(db: Db, userId: string) {
	const blocking = (await orgRepository(db).ownedOrgs(userId)).filter(
		(o) => o.owners === 1 && o.members > 1
	);
	if (blocking.length) {
		throw errors.conflict(
			`Make someone else an owner of ${blocking.map((o) => `"${o.name}"`).join(", ")} first, or delete it.`
		);
	}
}

/**
 * Runs before Better Auth deletes a user. Refuses when the user is the last owner of an org
 * others still use; deletes orgs only they belong to; hands their org projects to the org.
 */
export async function prepareAccountDeletion(db: Db, queue: Queue, userId: string) {
	const orgs = orgRepository(db);
	await assertCanDeleteAccount(db, userId);
	const owned = await orgs.ownedOrgs(userId);
	const solo = owned.filter((o) => o.members === 1).map((o) => o.orgId);

	const keys: string[] = [];
	for (const orgId of solo) keys.push(...(await orgs.blobKeys(orgId)));
	const personal = await db
		.select({ id: project.id })
		.from(project)
		.where(and(eq(project.ownerId, userId), isNull(project.organizationId)));
	keys.push(...(await projectRepository(db).blobKeysForProjects(personal.map((p) => p.id))));

	for (const orgId of solo) await orgs.deleteOrg(orgId);
	const memberships = await db
		.select({ orgId: member.organizationId })
		.from(member)
		.where(eq(member.userId, userId));
	for (const m of memberships) await transferOrgProjects(db, m.orgId, userId);

	if (keys.length) {
		await queue.enqueue({ type: "blobs.delete", keys }, { delaySeconds: PURGE_DELAY_SECONDS });
	}
}
