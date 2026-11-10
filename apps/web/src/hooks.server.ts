import type { Handle } from "@sveltejs/kit";
import { SERVER_URL } from "$lib/cloud/config";
import { readSession, UNCHECKED } from "$lib/server/session";

// The site is reachable on two custom domains; glyphtex.* is canonical. Redirect
// the legacy host so ranking signals and AI citations consolidate on one origin.
// Robust for SSR requests; prerendered pages also carry a <link rel="canonical">.
const LEGACY_HOST = "glyphx.nexonauts.com";
const CANONICAL_HOST = "glyphtex.nexonauts.com";

// Prerendered public pages stay account-free; only these read the session.
const AUTH_PATHS = ["/workspace", "/join/", "/invite/"];

// SvelteKit's own origin check is off (vite.config.ts) so partner sites can POST to /open. Every
// other path keeps the same rule here: cross-origin form-typed writes are refused.
const OPEN_PATH = "/open";
const FORM_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];

function crossOriginFormWrite(request: Request, url: URL): boolean {
	if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return false;
	const type = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
	if (!type || !FORM_TYPES.includes(type)) return false;
	return request.headers.get("origin") !== url.origin;
}

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname !== OPEN_PATH && crossOriginFormWrite(event.request, event.url)) {
		return new Response(`Cross-site ${event.request.method} form submissions are forbidden`, {
			status: 403
		});
	}
	const host = event.request.headers.get("host");
	if (host === LEGACY_HOST) {
		const url = new URL(event.request.url);
		url.host = CANONICAL_HOST;
		url.protocol = "https:";
		return new Response(null, { status: 301, headers: { location: url.toString() } });
	}
	event.locals.auth = AUTH_PATHS.some((p) => event.url.pathname.startsWith(p))
		? await readSession(SERVER_URL, event.request.headers.get("cookie"), event.fetch)
		: UNCHECKED;
	return resolve(event);
};
