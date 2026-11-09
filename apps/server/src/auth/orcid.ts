import type { GenericOAuthConfig, GenericOAuthUserInfo } from "better-auth/plugins/generic-oauth";
import { createPolicy, HttpError, retryableHttp } from "../lib/resilience.ts";

export const ORCID_PROVIDER_ID = "orcid";

interface OrcidUserInfo {
	sub?: string;
	name?: string;
	given_name?: string;
	family_name?: string;
}

const base = (sandbox: boolean) => (sandbox ? "https://sandbox.orcid.org" : "https://orcid.org");

/** ORCID releases no email address, so the account gets one that can't receive mail. */
export function orcidUser(info: OrcidUserInfo): GenericOAuthUserInfo | null {
	const id = info.sub?.trim();
	if (!id) return null;
	const name = info.name?.trim() || [info.given_name, info.family_name].filter(Boolean).join(" ");
	return { id, name: name || id, email: `${id}@orcid.invalid`, emailVerified: false };
}

/**
 * Sign in with ORCID through Better Auth's generic OAuth. ORCID offers only the `openid`
 * scope, signs the token request with `client_secret_post`, and doesn't advertise PKCE.
 */
export function orcidProvider(options: {
	clientId: string;
	clientSecret: string;
	sandbox: boolean;
}): GenericOAuthConfig<typeof ORCID_PROVIDER_ID> {
	const root = base(options.sandbox);
	const policy = createPolicy("ORCID", { retry: { shouldRetry: retryableHttp }, timeoutMs: 8_000 });
	return {
		providerId: ORCID_PROVIDER_ID,
		discoveryUrl: `${root}/.well-known/openid-configuration`,
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		scopes: ["openid"],
		authentication: "post",
		pkce: false,
		async getUserInfo(tokens) {
			if (!tokens.accessToken) return null;
			const info = await policy.run(async (signal) => {
				const res = await fetch(`${root}/oauth/userinfo`, {
					signal,
					headers: { authorization: `Bearer ${tokens.accessToken}`, accept: "application/json" }
				});
				if (!res.ok) throw new HttpError(res.status, `ORCID userinfo failed: ${res.status}`);
				return (await res.json()) as OrcidUserInfo;
			});
			return orcidUser(info);
		}
	};
}
