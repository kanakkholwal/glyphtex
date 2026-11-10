import { log } from "$lib/log";
import { type SessionOrg, type SessionUser, toSessionUser } from "$lib/cloud/session-user";

export interface SsrAuth {
	/** False when the server could not tell (cloud off, API down): the client decides then. */
	checked: boolean;
	user: SessionUser | null;
	activeOrgId: string | null;
	orgs: SessionOrg[];
}

export const UNCHECKED: SsrAuth = { checked: false, user: null, activeOrgId: null, orgs: [] };
const SIGNED_OUT: SsrAuth = { checked: true, user: null, activeOrgId: null, orgs: [] };

/** Reads the Better Auth session for this request by forwarding its cookies to the API. */
export async function readSession(
	serverUrl: string,
	cookie: string | null,
	fetcher: typeof fetch
): Promise<SsrAuth> {
	if (!serverUrl) return UNCHECKED;
	// No cookie: signed out, or the cookie isn't shared with this origin. Both look the same here.
	if (!cookie) return SIGNED_OUT;
	const call = (path: string) =>
		fetcher(`${serverUrl}/api/auth${path}`, {
			headers: { cookie, accept: "application/json" },
			signal: AbortSignal.timeout(1500)
		});
	try {
		const [sessionRes, orgsRes] = await Promise.all([
			call("/get-session"),
			call("/organization/list")
		]);
		if (!sessionRes.ok) return UNCHECKED;
		const data = (await sessionRes.json()) as {
			user?: Parameters<typeof toSessionUser>[0];
			session?: { activeOrganizationId?: string | null };
		} | null;
		if (!data?.user) return SIGNED_OUT;
		const orgs = orgsRes.ok ? ((await orgsRes.json()) as SessionOrg[] | null) : null;
		return {
			checked: true,
			user: toSessionUser(data.user),
			activeOrgId: data.session?.activeOrganizationId ?? null,
			orgs: (orgs ?? []).map(({ id, name, slug, logo }) => ({ id, name, slug, logo }))
		};
	} catch (error) {
		log.warn("ssr session check failed", error);
		return UNCHECKED;
	}
}
