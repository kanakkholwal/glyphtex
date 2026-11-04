import type { Deps } from "../context.ts";
import type { Feature } from "../db/schema.ts";
import { errors } from "../lib/errors.ts";
import {
	type OrgPermission,
	type Policy,
	canOrg,
	orgCapabilities,
	resolveFeatures
} from "../rbac/org.ts";
import { orgRepository } from "../repositories/orgs.ts";
import { projectRepository } from "../repositories/projects.ts";

export interface OrgAccess {
	orgId: string;
	role: string;
}

/** Deny by default; non-members get 404 so org ids can't be probed. */
export async function authorizeOrg(
	deps: Pick<Deps, "db">,
	userId: string,
	orgId: string,
	permission: OrgPermission
): Promise<OrgAccess> {
	const role = await orgRepository(deps.db).membership(orgId, userId);
	if (!role) throw errors.notFound("Organization");
	if (!canOrg(role, permission)) throw errors.forbidden();
	return { orgId, role };
}

/** The features a member actually has in an org: their override, else the org default. */
export async function featuresFor(deps: Pick<Deps, "db">, orgId: string, userId: string) {
	const orgs = orgRepository(deps.db);
	const [policy, overrides] = await Promise.all([
		orgs.policy(orgId),
		orgs.overrides(orgId, userId)
	]);
	return { policy, features: resolveFeatures(policy, overrides) };
}

const csvCell = (v: unknown) => {
	const s = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function orgService(deps: Deps) {
	const orgs = orgRepository(deps.db);

	return {
		async view({ orgId, role }: OrgAccess, userId: string) {
			const org = await orgs.get(orgId);
			if (!org) throw errors.notFound("Organization");
			const { policy, features } = await featuresFor(deps, orgId, userId);
			return { organization: org, role, capabilities: orgCapabilities(role), policy, features };
		},

		async updatePolicy({ orgId }: OrgAccess, actorId: string, patch: Partial<Policy>) {
			const before = await orgs.policy(orgId);
			const next = await orgs.savePolicy(orgId, patch);
			const changed = (Object.keys(patch) as (keyof Policy)[]).filter((k) => before[k] !== next[k]);
			if (changed.length) {
				await orgs.audit({
					organizationId: orgId,
					actorId,
					action: "policy.updated",
					targetType: "organization",
					targetId: orgId,
					meta: Object.fromEntries(changed.map((k) => [k, next[k]]))
				});
			}
			return next;
		},

		async memberFeatures({ orgId }: OrgAccess, userId: string) {
			if (!(await orgs.membership(orgId, userId))) throw errors.notFound("Member");
			return featuresFor(deps, orgId, userId);
		},

		async setMemberFeature(
			{ orgId }: OrgAccess,
			actorId: string,
			userId: string,
			feature: Feature,
			enabled: boolean | null
		) {
			if (!(await orgs.membership(orgId, userId))) throw errors.notFound("Member");
			await orgs.setOverride(orgId, userId, feature, enabled);
			await orgs.audit({
				organizationId: orgId,
				actorId,
				action: "member.feature_changed",
				targetType: "user",
				targetId: userId,
				meta: { feature, enabled }
			});
			return featuresFor(deps, orgId, userId);
		},

		projects: ({ orgId }: OrgAccess, userId: string) =>
			projectRepository(deps.db).listForOrg(orgId, userId),

		stats: ({ orgId }: OrgAccess) => orgs.stats(orgId),

		audit: ({ orgId }: OrgAccess, before: Date | undefined, limit: number) =>
			orgs.listAudit(orgId, before, limit),

		/** Everything still retained, newest first, as RFC 4180 CSV. */
		async auditCsv({ orgId }: OrgAccess) {
			const lines = ["time,actor,actor_email,action,target_type,target_id,details"];
			let before: Date | undefined;
			for (;;) {
				const page = await orgs.listAudit(orgId, before, 1000);
				for (const e of page) {
					lines.push(
						[
							e.createdAt.toISOString(),
							e.actorName,
							e.actorEmail,
							e.action,
							e.targetType,
							e.targetId,
							e.meta
						]
							.map(csvCell)
							.join(",")
					);
				}
				if (page.length < 1000) break;
				before = page.at(-1)?.createdAt;
			}
			return `${lines.join("\n")}\n`;
		}
	};
}
