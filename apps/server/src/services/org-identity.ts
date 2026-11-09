import { eq } from "drizzle-orm";
import type { Deps } from "../context.ts";
import { ssoProvider } from "../db/schema.ts";
import { errors } from "../lib/errors.ts";
import { orgRepository } from "../repositories/orgs.ts";
import type { OrgAccess } from "./orgs.ts";

const SCOPES = [
	"scim.users.read",
	"scim.users.write",
	"scim.groups.read",
	"scim.groups.write"
] as const;
const DAY_MS = 86_400_000;

/** Single sign-on providers and SCIM directory sync for one organization. */
export function orgIdentityService(deps: Deps) {
	const { db, auth, config } = deps;
	const orgs = orgRepository(db);
	const scimUrl = `${config.publicUrl}/api/auth/scim/v2`;
	const expiry = (days: number) => new Date(Date.now() + days * DAY_MS);
	const request = (orgId: string) => crypto.randomUUID() + crypto.randomUUID();

	return {
		async sso({ orgId }: OrgAccess) {
			const rows = await db
				.select({
					providerId: ssoProvider.providerId,
					domain: ssoProvider.domain,
					issuer: ssoProvider.issuer,
					domainVerified: ssoProvider.domainVerified,
					oidc: ssoProvider.oidcConfig
				})
				.from(ssoProvider)
				.where(eq(ssoProvider.organizationId, orgId));
			return rows.map(({ oidc, domainVerified, ...p }) => ({
				...p,
				type: oidc ? ("oidc" as const) : ("saml" as const),
				domainVerified: domainVerified === true
			}));
		},

		async scim({ orgId }: OrgAccess) {
			const { connections } = await auth.api.listSCIMManagedConnections({
				body: { provisioningDomainId: orgId }
			});
			return {
				url: scimUrl,
				connections: connections
					.filter((c) => c.status !== "decommissioned")
					.map((c) => ({
						connectionId: c.connectionId,
						status: c.status,
						createdAt: c.createdAt
					}))
			};
		},

		/** The bearer token is returned once; only its keyed digest is stored. */
		async createScim({ orgId }: OrgAccess, actorId: string, expiresInDays: number) {
			const existing = await this.scim({ orgId, role: "owner" });
			if (existing.connections.length >= 3) {
				throw errors.conflict("Remove an existing directory connection before adding another.");
			}
			const created = await auth.api.createSCIMManagedConnection({
				body: {
					creationRequestId: request(orgId),
					provisioningDomainId: orgId,
					actorId,
					scopes: [...SCOPES],
					expiresAt: expiry(expiresInDays)
				}
			});
			await orgs.audit({
				organizationId: orgId,
				actorId,
				action: "scim.connection_created",
				targetType: "scim_connection",
				targetId: created.connection.connectionId
			});
			return { url: scimUrl, connectionId: created.connection.connectionId, token: created.token };
		},

		async rotateScim(
			{ orgId }: OrgAccess,
			actorId: string,
			connectionId: string,
			expiresInDays: number
		) {
			const rotated = await auth.api.rotateSCIMManagedCredential({
				body: {
					connectionId,
					provisioningDomainId: orgId,
					actorId,
					scopes: [...SCOPES],
					expiresAt: expiry(expiresInDays)
				}
			});
			await orgs.audit({
				organizationId: orgId,
				actorId,
				action: "scim.credential_rotated",
				targetType: "scim_connection",
				targetId: connectionId
			});
			return { url: scimUrl, connectionId, token: rotated.token };
		},

		async removeScim({ orgId }: OrgAccess, actorId: string, connectionId: string) {
			await auth.api.decommissionSCIMManagedConnection({
				body: { connectionId, provisioningDomainId: orgId, actorId }
			});
			await orgs.audit({
				organizationId: orgId,
				actorId,
				action: "scim.connection_removed",
				targetType: "scim_connection",
				targetId: connectionId
			});
		}
	};
}
