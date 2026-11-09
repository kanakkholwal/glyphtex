import type { SCIMIdentity, SCIMProjection } from "@better-auth/scim";
import type { Db } from "../db/client.ts";
import { orgRepository } from "../repositories/orgs.ts";
import { transferOrgProjects } from "../services/org-lifecycle.ts";

/** A provisioned user is linked to an existing account only when the org proved the email's domain. */
export function scimIdentity(): SCIMIdentity {
	return {
		async resolveUser({ resource, provisioningDomainId }, { database }) {
			const email = resource.primaryEmail.toLowerCase();
			const existing = await database.findOne<{ id: string }>({
				model: "user",
				where: [{ field: "email", value: email }]
			});
			if (!existing) return { action: "create" };
			const domain = email.split("@")[1] ?? "";
			const verified = await database.findOne({
				model: "ssoProvider",
				where: [
					{ field: "organizationId", value: provisioningDomainId },
					{ field: "domain", value: domain },
					{ field: "domainVerified", value: true }
				]
			});
			return verified
				? { action: "link", userId: existing.id, profile: "preserve" }
				: { action: "create" };
		}
	};
}

/** The provisioning domain is the org id: active adds the member, inactive removes them. */
export function scimProjection(db: Db): SCIMProjection {
	const orgs = orgRepository(db);
	return {
		async reconcileUser({ provisioningDomainId: orgId, userId, active }, { database }) {
			const current = await database.findOne<{ id: string; role: string }>({
				model: "member",
				where: [
					{ field: "organizationId", value: orgId },
					{ field: "userId", value: userId }
				]
			});
			if (active && !current) {
				const { seatLimit } = await orgs.policy(orgId);
				if (seatLimit !== null) {
					const seats = await database.count({
						model: "member",
						where: [{ field: "organizationId", value: orgId }]
					});
					if (seats >= seatLimit) throw new Error("The organization has no free seats.");
				}
				await database.create({
					model: "member",
					data: { organizationId: orgId, userId, role: "member", createdAt: new Date() }
				});
				await orgs.audit({
					organizationId: orgId,
					actorId: null,
					action: "member.added",
					targetType: "user",
					targetId: userId,
					meta: { via: "scim" }
				});
			} else if (!active && current && current.role !== "owner") {
				// Owners are never removed by a directory: someone must stay accountable for the org.
				await database.delete({ model: "member", where: [{ field: "id", value: current.id }] });
				const moved = await transferOrgProjects(db, orgId, userId);
				await orgs.audit({
					organizationId: orgId,
					actorId: null,
					action: "member.removed",
					targetType: "user",
					targetId: userId,
					meta: { via: "scim", projectsTransferred: moved }
				});
			}
		}
	};
}
