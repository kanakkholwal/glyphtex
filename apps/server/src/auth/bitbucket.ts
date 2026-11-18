import type { GenericOAuthConfig, GenericOAuthUserInfo } from "better-auth/plugins/generic-oauth";
import { createPolicy, HttpError, retryableHttp } from "../lib/resilience.ts";

export const BITBUCKET_PROVIDER_ID = "bitbucket";

interface BitbucketUser {
	uuid?: string;
	display_name?: string;
	nickname?: string;
}

/** Bitbucket may withhold the email; the account then gets one that can't receive mail. */
export function bitbucketUser(info: BitbucketUser, email?: string): GenericOAuthUserInfo | null {
	const id = info.uuid?.trim();
	if (!id) return null;
	const name = info.display_name?.trim() || info.nickname?.trim() || id;
	return email
		? { id, name, email, emailVerified: true }
		: { id, name, email: `${id.replace(/[{}]/g, "")}@bitbucket.invalid`, emailVerified: false };
}

/**
 * Bitbucket Cloud through Better Auth's generic OAuth, for linking a repository host to an account.
 * It has no built-in provider. Sign-up is disabled so it can only attach to someone already signed in.
 */
export function bitbucketProvider(options: {
	clientId: string;
	clientSecret: string;
}): GenericOAuthConfig<typeof BITBUCKET_PROVIDER_ID> {
	const policy = createPolicy("Bitbucket", {
		retry: { shouldRetry: retryableHttp },
		timeoutMs: 8_000
	});
	const get = <T>(path: string, token: string) =>
		policy.run(async (signal) => {
			const res = await fetch(`https://api.bitbucket.org/2.0${path}`, {
				signal,
				headers: { authorization: `Bearer ${token}`, accept: "application/json" }
			});
			if (!res.ok) throw new HttpError(res.status, `Bitbucket ${path} failed: ${res.status}`);
			return (await res.json()) as T;
		});
	return {
		providerId: BITBUCKET_PROVIDER_ID,
		authorizationUrl: "https://bitbucket.org/site/oauth2/authorize",
		tokenUrl: "https://bitbucket.org/site/oauth2/access_token",
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		// Bitbucket takes permissions from the OAuth consumer's settings, not from the request.
		scopes: [],
		authentication: "basic",
		pkce: false,
		disableSignUp: true,
		async getUserInfo(tokens) {
			if (!tokens.accessToken) return null;
			const user = await get<BitbucketUser>("/user", tokens.accessToken);
			const emails = await get<{ values?: { email: string; is_primary: boolean }[] }>(
				"/user/emails",
				tokens.accessToken
			).catch(() => undefined);
			const primary = emails?.values?.find((e) => e.is_primary)?.email;
			return bitbucketUser(user, primary);
		}
	};
}
