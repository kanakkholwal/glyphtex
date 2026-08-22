import type { Handle } from "@sveltejs/kit";

// The site is reachable on two custom domains; glyphtex.* is canonical. Redirect
// the legacy host so ranking signals and AI citations consolidate on one origin.
// Robust for SSR requests; prerendered pages also carry a <link rel="canonical">.
const LEGACY_HOST = "glyphx.nexonauts.com";
const CANONICAL_HOST = "glyphtex.nexonauts.com";

export const handle: Handle = ({ event, resolve }) => {
	const host = event.request.headers.get("host");
	if (host === LEGACY_HOST) {
		const url = new URL(event.request.url);
		url.host = CANONICAL_HOST;
		url.protocol = "https:";
		return new Response(null, { status: 301, headers: { location: url.toString() } });
	}
	return resolve(event);
};
