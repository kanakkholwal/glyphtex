import { scim } from "@better-auth/scim";
import { sso } from "@better-auth/sso";
import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { magicLink } from "better-auth/plugins/magic-link";
import { organization } from "better-auth/plugins/organization";
import { twoFactor } from "better-auth/plugins/two-factor";
import type { Queue } from "../adapters/types.ts";
import type { Config } from "../config.ts";
import type { Db } from "../db/client.ts";
import { schema } from "../db/schema.ts";
import { mails } from "../mail/templates.ts";
import { AppError } from "../lib/errors.ts";
import { orgRepository } from "../repositories/orgs.ts";
import { orcidProvider } from "./orcid.ts";
import { scimIdentity, scimProjection } from "./scim.ts";
import {
	assertCanDeleteAccount,
	PURGE_DELAY_SECONDS,
	prepareAccountDeletion,
	purgeOrgDirectory,
	transferOrgProjects
} from "../services/org-lifecycle.ts";

export interface AuthDeps {
	config: Config;
	db: Db;
	queue: Queue;
}

/** Better Auth reports hook failures from its own error type; keep our plain-language message. */
async function asAuthError(run: () => Promise<void>) {
	try {
		await run();
	} catch (error) {
		if (error instanceof AppError) {
			throw new APIError(error.status === 409 ? "CONFLICT" : "BAD_REQUEST", {
				message: error.message
			});
		}
		throw error;
	}
}

type HookCtx = { context?: { session?: { user?: { id?: string } } | null } } | undefined;
const actorOf = (ctx: HookCtx, fallback: string | null) =>
	ctx?.context?.session?.user?.id ?? fallback;

export function createAuth({ config, db, queue }: AuthDeps) {
	const sendMail = (mail: ReturnType<(typeof mails)[keyof typeof mails]>) =>
		queue.enqueue({ type: "email.send", mail });
	const { google, github, gitlab, gitlabIssuer, orcid, orcidSandbox } = config.oauth;
	const orgs = orgRepository(db);

	return betterAuth({
		baseURL: config.publicUrl,
		basePath: "/api/auth",
		secret: config.authSecret,
		trustedOrigins: config.webOrigins,
		database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
		// No secondaryStorage: Better Auth needs atomic increment/get-and-delete from it, which
		// KV can't give. Sessions and auth rate limits stay in Postgres, the source of truth.
		rateLimit: { enabled: true, storage: "database" },
		hooks: {
			// Check before the confirmation email goes out, not only when its link is opened.
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path === "/sso/register" && !ctx.body?.organizationId) {
					// Without an org the provider would be personal, and its domain could capture sign-ins.
					throw new APIError("BAD_REQUEST", {
						message: "Single sign-on is set up for an organization."
					});
				}
				if (ctx.path !== "/delete-user") return;
				const session = await getSessionFromCtx(ctx);
				if (session) await asAuthError(() => assertCanDeleteAccount(db, session.user.id));
			}),
			after: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== "/sso/register" || !ctx.body?.organizationId) return;
				const session = await getSessionFromCtx(ctx);
				await orgs.audit({
					organizationId: ctx.body.organizationId,
					actorId: session?.user.id ?? null,
					action: "sso.provider_added",
					targetType: "sso_provider",
					targetId: ctx.body.providerId ?? null,
					meta: { domain: ctx.body.domain ?? null }
				});
			})
		},
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: config.requireEmailVerification,
			minPasswordLength: 10,
			sendResetPassword: async ({ user, url }) => sendMail(mails.resetPassword(user.email, url))
		},
		emailVerification: {
			sendOnSignUp: config.requireEmailVerification,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user, url }) => sendMail(mails.verifyEmail(user.email, url))
		},
		socialProviders: {
			...(google && { google }),
			...(github && { github }),
			...(gitlab && { gitlab: { ...gitlab, ...(gitlabIssuer && { issuer: gitlabIssuer }) } })
		},
		account: {
			accountLinking: { enabled: true, trustedProviders: ["google", "github", "gitlab"] }
		},
		user: {
			deleteUser: {
				enabled: true,
				sendDeleteAccountVerification: async ({ user, url }) =>
					sendMail(mails.deleteAccount(user.email, url)),
				// Hard delete: rows cascade from `user`; blobs are queued here because the
				// keys are gone once the rows are.
				beforeDelete: (user) => asAuthError(() => prepareAccountDeletion(db, queue, user.id))
			}
		},
		advanced: {
			ipAddress: { ipAddressHeaders: [config.clientIpHeader] },
			...(config.cookieDomain && {
				crossSubDomainCookies: { enabled: true, domain: config.cookieDomain }
			})
		},
		plugins: [
			...(orcid
				? [genericOAuth({ config: [orcidProvider({ ...orcid, sandbox: orcidSandbox })] })]
				: []),
			twoFactor({ issuer: "GlyphTeX" }),
			sso({
				domainVerification: { enabled: true },
				providersLimit: 5,
				organizationProvisioning: { defaultRole: "member" }
			}),
			scim({
				connections: [],
				managedConnections: { credentialHashSecret: config.scimSecret },
				identity: scimIdentity(),
				projection: scimProjection(db)
			}),
			magicLink({ sendMagicLink: async ({ email, url }) => sendMail(mails.magicLink(email, url)) }),
			organization({
				creatorRole: "owner",
				invitationExpiresIn: config.limits.inviteTtlHours * 3600,
				cancelPendingInvitationsOnReInvite: true,
				requireEmailVerificationOnInvitation: config.requireEmailVerification,
				membershipLimit: async (_user, org) =>
					(await orgs.policy(org.id)).seatLimit ?? Number.MAX_SAFE_INTEGER,
				sendInvitationEmail: async ({ id, email, organization: org, inviter, role }) =>
					sendMail(
						mails.orgInvite(
							email,
							inviter.user.name || inviter.user.email,
							org.name,
							role,
							`${config.appUrl}/workspace/org-invite/${encodeURIComponent(id)}`
						)
					),
				organizationHooks: {
					afterCreateOrganization: async ({ organization: org, user }) =>
						orgs.audit({
							organizationId: org.id,
							actorId: user.id,
							action: "org.created",
							targetType: "organization",
							targetId: org.id
						}),
					afterUpdateOrganization: async ({ organization: org, user }) => {
						if (!org) return;
						await orgs.audit({
							organizationId: org.id,
							actorId: user.id,
							action: "org.updated",
							targetType: "organization",
							targetId: org.id
						});
					},
					// Rows cascade with the org; its files are purged once the delete has committed.
					beforeDeleteOrganization: async ({ organization: org }) => {
						await purgeOrgDirectory(db, org.id);
						const keys = await orgs.blobKeys(org.id);
						if (keys.length) {
							await queue.enqueue(
								{ type: "blobs.delete", keys },
								{ delaySeconds: PURGE_DELAY_SECONDS }
							);
						}
					},
					afterAddMember: async ({ member: m, user }, ctx?: HookCtx) =>
						orgs.audit({
							organizationId: m.organizationId,
							actorId: actorOf(ctx, null),
							action: "member.added",
							targetType: "user",
							targetId: user.id,
							meta: { role: m.role }
						}),
					afterRemoveMember: async ({ member: m, user }, ctx?: HookCtx) => {
						const moved = await transferOrgProjects(db, m.organizationId, user.id);
						await orgs.audit({
							organizationId: m.organizationId,
							actorId: actorOf(ctx, null),
							action: "member.removed",
							targetType: "user",
							targetId: user.id,
							meta: { projectsTransferred: moved }
						});
					},
					afterUpdateMemberRole: async ({ member: m, previousRole, user }, ctx?: HookCtx) =>
						orgs.audit({
							organizationId: m.organizationId,
							actorId: actorOf(ctx, null),
							action: "member.role_changed",
							targetType: "user",
							targetId: user.id,
							meta: { from: previousRole, to: m.role }
						}),
					afterCreateInvitation: async ({ invitation: inv, inviter }) =>
						orgs.audit({
							organizationId: inv.organizationId,
							actorId: inviter.id,
							action: "invitation.created",
							targetType: "invitation",
							targetId: inv.id,
							meta: { role: inv.role ?? "member" }
						}),
					afterAcceptInvitation: async ({ invitation: inv, user }) =>
						orgs.audit({
							organizationId: inv.organizationId,
							actorId: user.id,
							action: "invitation.accepted",
							targetType: "invitation",
							targetId: inv.id
						}),
					afterCancelInvitation: async ({ invitation: inv, cancelledBy }) =>
						orgs.audit({
							organizationId: inv.organizationId,
							actorId: cancelledBy.id,
							action: "invitation.cancelled",
							targetType: "invitation",
							targetId: inv.id
						})
				}
			})
		]
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth["$Infer"]["Session"]["session"];
export type AuthUser = Auth["$Infer"]["Session"]["user"];
