import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import type { Queue } from "../adapters/types.ts";
import type { Config } from "../config.ts";
import type { Db } from "../db/client.ts";
import { schema } from "../db/schema.ts";
import { mails } from "../mail/templates.ts";
import { projectRepository } from "../repositories/projects.ts";

export interface AuthDeps {
	config: Config;
	db: Db;
	queue: Queue;
}

// Long enough for the user deletion to commit; the purge job skips any key still referenced.
const ACCOUNT_PURGE_DELAY_SECONDS = 300;

export function createAuth({ config, db, queue }: AuthDeps) {
	const sendMail = (mail: ReturnType<(typeof mails)[keyof typeof mails]>) =>
		queue.enqueue({ type: "email.send", mail });
	const { google, github, gitlab, gitlabIssuer } = config.oauth;

	return betterAuth({
		baseURL: config.publicUrl,
		basePath: "/api/auth",
		secret: config.authSecret,
		trustedOrigins: config.webOrigins,
		database: drizzleAdapter(db, { provider: "pg", schema }),
		// No secondaryStorage: Better Auth needs atomic increment/get-and-delete from it, which
		// KV can't give. Sessions and auth rate limits stay in Postgres, the source of truth.
		rateLimit: { enabled: true, storage: "database" },
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			minPasswordLength: 10,
			sendResetPassword: async ({ user, url }) => sendMail(mails.resetPassword(user.email, url))
		},
		emailVerification: {
			sendOnSignUp: true,
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
				beforeDelete: async (user) => {
					const projects = projectRepository(db);
					const owned = await projects.listOwned(user.id);
					const keys = await projects.blobKeysForProjects(owned.map((p) => p.id));
					if (keys.length) {
						await queue.enqueue(
							{ type: "blobs.delete", keys },
							{ delaySeconds: ACCOUNT_PURGE_DELAY_SECONDS }
						);
					}
				}
			}
		},
		advanced: {
			ipAddress: { ipAddressHeaders: [config.clientIpHeader] },
			...(config.cookieDomain && {
				crossSubDomainCookies: { enabled: true, domain: config.cookieDomain }
			})
		},
		plugins: [
			magicLink({ sendMagicLink: async ({ email, url }) => sendMail(mails.magicLink(email, url)) })
		]
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth["$Infer"]["Session"]["session"];
export type AuthUser = Auth["$Infer"]["Session"]["user"];
