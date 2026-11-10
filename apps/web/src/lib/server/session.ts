import { authClient } from "$lib/cloud/auth";
import { type SessionOrg, type SessionUser, toSessionUser } from "$lib/cloud/session-user";
import { log } from "$lib/log";

export interface SsrAuth {
	/** True only when the API answered. Otherwise the browser decides (see readSession). */
	checked: boolean;
	user: SessionUser | null;
	activeOrgId: string | null;
	orgs: SessionOrg[];
}

export const UNCHECKED: SsrAuth = { checked: false, user: null, activeOrgId: null, orgs: [] };

/** Asks Better Auth who this request belongs to, forwarding the visitor's cookies. */
export async function readSession(
	serverUrl: string,
	cookie: string | null,
	fetcher: typeof fetch
): Promise<SsrAuth> {
	// No cookie visible here does not mean signed out: the session cookie may be scoped to the API
	// origin only. Leave it to the browser rather than wrongly bouncing a signed-in user.
	if (!serverUrl || !cookie) return UNCHECKED;
	const fetchOptions = {
		headers: { cookie },
		customFetchImpl: fetcher,
		signal: AbortSignal.timeout(1500)
	};
	try {
		const { data, error } = await authClient.getSession({ fetchOptions });
		if (error) return UNCHECKED;
		if (!data?.user) return { checked: true, user: null, activeOrgId: null, orgs: [] };
		const orgs = await authClient.organization.list({ fetchOptions });
		return {
			checked: true,
			user: toSessionUser(data.user),
			activeOrgId: data.session.activeOrganizationId ?? null,
			orgs: (orgs.data ?? []).map(({ id, name, slug, logo }) => ({ id, name, slug, logo }))
		};
	} catch (error) {
		log.warn("ssr session check failed", error);
		return UNCHECKED;
	}
}
