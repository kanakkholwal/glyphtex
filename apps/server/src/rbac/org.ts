import type { Feature, MemberAccess, OrgRole, ProjectRole } from "../db/schema.ts";

export const ORG_PERMISSIONS = [
	"org:read",
	"org:create-project",
	"org:manage-members",
	"org:manage-policy",
	"org:read-audit",
	"org:delete"
] as const;

export type OrgPermission = (typeof ORG_PERMISSIONS)[number];

const MEMBER: readonly OrgPermission[] = ["org:read", "org:create-project"];
const ADMIN: readonly OrgPermission[] = [
	...MEMBER,
	"org:manage-members",
	"org:manage-policy",
	"org:read-audit"
];

/** The org grant table, the counterpart of ROLE_GRANTS for projects. */
export const ORG_GRANTS: Record<OrgRole, ReadonlySet<OrgPermission>> = {
	member: new Set(MEMBER),
	admin: new Set(ADMIN),
	owner: new Set(ORG_PERMISSIONS)
};

/** Better Auth stores roles as free text (custom roles later); unknown ones get member rights. */
export const asOrgRole = (role: string): OrgRole =>
	role === "owner" || role === "admin" ? role : "member";

export const canOrg = (role: string | null, permission: OrgPermission) =>
	role !== null && ORG_GRANTS[asOrgRole(role)].has(permission);

export const orgCapabilities = (role: string) => [...ORG_GRANTS[asOrgRole(role)]];

export interface Policy {
	memberAccess: MemberAccess;
	shareLinks: boolean;
	externalInvites: boolean;
	ai: boolean;
	seatLimit: number | null;
}

export const DEFAULT_POLICY: Policy = {
	memberAccess: "editor",
	shareLinks: true,
	externalInvites: true,
	ai: false,
	seatLimit: null
};

/**
 * What an org role grants on the org's projects: admins manage them like owners;
 * plain members get the policy's default, which may be nothing at all.
 */
export function roleFromOrg(orgRole: string, policy: Policy): ProjectRole | null {
	const role = asOrgRole(orgRole);
	if (role === "owner" || role === "admin") return "owner";
	return policy.memberAccess === "none" ? null : policy.memberAccess;
}

/** A member's override wins over the org default; the org default wins over nothing. */
export function resolveFeatures(
	policy: Policy,
	overrides: { feature: Feature; enabled: boolean }[]
): Record<Feature, boolean> {
	const base: Record<Feature, boolean> = {
		ai: policy.ai,
		shareLinks: policy.shareLinks,
		externalInvites: policy.externalInvites
	};
	for (const o of overrides) base[o.feature] = o.enabled;
	return base;
}
