import { log } from "$lib/log";

export interface SsrAuth {
	/** False when the server could not tell (no cookie visible, API down): the client decides then. */
	checked: boolean;
	user: { id: string; name: string; email: string; image: string | null } | null;
	activeOrgId: string | null;
}

export const UNCHECKED: SsrAuth = { checked: false, user: null, activeOrgId: null };

/** Reads the Better Auth session for this request by forwarding its cookies to the API. */
export async function readSession(
	serverUrl: string,
	cookie: string | null,
	fetcher: typeof fetch
): Promise<SsrAuth> {
	if (!serverUrl) return UNCHECKED;
	// No cookie: either signed out or the cookie isn't shared with this origin. Both look the same here.
	if (!cookie) return { checked: true, user: null, activeOrgId: null };
	try {
		const res = await fetcher(`${serverUrl}/api/auth/get-session`, {
			headers: { cookie, accept: "application/json" },
			signal: AbortSignal.timeout(1500)
		});
		if (!res.ok) return UNCHECKED;
		const data = (await res.json()) as {
			user?: { id: string; name: string; email: string; image?: string | null };
			session?: { activeOrganizationId?: string | null };
		} | null;
		if (!data?.user) return { checked: true, user: null, activeOrgId: null };
		const { id, name, email, image } = data.user;
		return {
			checked: true,
			user: { id, name, email, image: image ?? null },
			activeOrgId: data.session?.activeOrganizationId ?? null
		};
	} catch (error) {
		log.warn("ssr session check failed", error);
		return UNCHECKED;
	}
}
