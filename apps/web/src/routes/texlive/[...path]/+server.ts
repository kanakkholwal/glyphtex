// Same-origin TeX Live endpoint. The in-browser engine fetches
// `/texlive/pdftex/<n>/<file>`; this route resolves each file in order:
//   1. a vendored copy in our own static assets (no third party at all),
//   2. our Cloudflare edge cache (immutable per path — fills itself on first use),
//   3. an upstream on-demand server (our own PUBLIC_TEXLIVE_ENDPOINT first, then
//      the public one), whose response we cache at our edge.
//
// Net effect: the engine only ever talks to OUR domain. The third-party server
// is a cached backend behind our edge, not a hard dependency — once a file is
// cached (here, or in the per-device service-worker cache) it keeps working even
// if every upstream is down. Point PUBLIC_TEXLIVE_ENDPOINT at your own
// `texlive-ondemand-server` for full independence; we still edge-cache it.

import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';

/** Public maintained on-demand server — the last-resort upstream. */
const PUBLIC_UPSTREAM = 'https://texlive.texlyre.org/';

const withSlash = (u: string) => (u.endsWith('/') ? u : `${u}/`);

/** Upstreams to proxy from, in order: your own server first, then the public one. */
function upstreams(): string[] {
	return [
		...new Set(
			[env.PUBLIC_TEXLIVE_ENDPOINT, PUBLIC_UPSTREAM]
				.filter((u): u is string => !!u)
				.map(withSlash)
		)
	];
}

// Critical files served straight from our static assets — never an upstream.
// The format dump is the big, version-pinned blocker; vendor it with
// `node scripts/dev/fetch-texlive-base.mjs` so cold starts survive an upstream
// outage. Missing vendored file → falls through to the edge/upstream path.
const VENDORED: Record<string, string> = {
	'pdftex/10/swiftlatexpdftex.fmt': '/swiftlatex/swiftlatexpdftex.fmt'
};

const BASE_HEADERS = {
	'access-control-allow-origin': '*',
	// Files are immutable per path (a package's content is fixed for a TL snapshot).
	'cache-control': 'public, max-age=31536000, immutable'
};

const contentType = (res: Response) =>
	res.headers.get('content-type') ?? 'application/octet-stream';

export const GET: RequestHandler = async ({ params, fetch, request, platform }) => {
	const path = params.path; // e.g. "pdftex/10/swiftlatexpdftex.fmt"

	// 1. Vendored, same-origin copy — guaranteed, independent of any upstream.
	const vendored = VENDORED[path];
	if (vendored) {
		const res = await fetch(vendored);
		if (res.ok) {
			return new Response(res.body, {
				status: 200,
				headers: { ...BASE_HEADERS, 'content-type': contentType(res) }
			});
		}
	}

	// 2. Our Cloudflare edge cache (absent in local dev → skipped).
	const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });
	if (edge) {
		const hit = await edge.match(cacheKey);
		if (hit) return hit;
	}

	// 3. Upstreams in order; first hit wins and is cached at our edge.
	for (const base of upstreams()) {
		let res: Response;
		try {
			res = await fetch(base + path);
		} catch {
			continue; // try the next upstream
		}
		if (!res.ok) continue;

		const out = new Response(res.body, {
			status: 200,
			headers: { ...BASE_HEADERS, 'content-type': contentType(res) }
		});
		if (edge) {
			const put = edge.put(cacheKey, out.clone());
			const ctx = (platform as { context?: { waitUntil?: (p: Promise<unknown>) => void } } | undefined)
				?.context;
			if (ctx?.waitUntil) ctx.waitUntil(put);
			else await put;
		}
		return out;
	}

	return new Response(`TeX file not available upstream: ${path}`, {
		status: 502,
		headers: { 'access-control-allow-origin': '*' }
	});
};
