// Same-origin TeX Live endpoint. The in-browser engine fetches
// `/texlive/pdftex/<n>/<file>`; this route resolves each file in order:
//   1. a vendored copy in our own static assets (no third party at all),
//   2. our Cloudflare edge cache (fast, per-colo, evictable),
//   3. our durable R2 mirror (account-owned, free egress; survives edge
//      eviction and deploys, and self-populates from real traffic),
//   4. an upstream, in order — our own curated CDN bundle (PUBLIC_TEXMIRROR_CDN,
//      e.g. jsDelivr over a GitHub repo / npm package), then our own on-demand
//      server (PUBLIC_TEXLIVE_ENDPOINT), then the public TeXlyre server — each
//      buffered and written back to R2 + the edge cache.
//
// Net effect: the engine only ever talks to OUR domain, and every file an
// upstream serves is captured into R2 forever — so the third-party server is hit
// at most once per file and the mirror grows itself with no capture tooling.
// Card-free option: publish your captured bundle to jsDelivr (a GitHub repo or
// npm package) and set PUBLIC_TEXMIRROR_CDN — see docs/self-host-texlive.md.

import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { dev } from '$app/environment';

// Minimal structural shape of the Cloudflare bindings we use (avoids depending
// on @cloudflare/workers-types here; payloads are narrowed where consumed).
type R2ObjectBody = {
	body: ReadableStream;
	httpMetadata?: { contentType?: string };
};
type Platform = {
	env?: {
		ASSETS?: { fetch: (input: string) => Promise<Response> };
		TEXLIVE?: {
			get: (key: string) => Promise<R2ObjectBody | null>;
			put: (
				key: string,
				value: Uint8Array,
				opts?: { httpMetadata?: { contentType?: string } }
			) => Promise<unknown>;
		};
	};
	context?: { waitUntil?: (p: Promise<unknown>) => void };
};

// Dev-only: persist proxied files to the on-disk base bundle as you compile, so
// the mirror builds itself with no browser-automation tooling — just run the dev
// server with MIRROR_WRITE=1 and compile a representative document in your
// browser. `dev` is statically false in the production build, so this and its
// node:fs import are stripped from the Cloudflare worker (which has a read-only FS).
async function writeMirror(path: string, bytes: Uint8Array): Promise<void> {
	if (!dev || typeof process === 'undefined' || process.env?.MIRROR_WRITE !== '1') return;
	try {
		const { mkdir, writeFile } = await import('node:fs/promises');
		const { dirname, join } = await import('node:path');
		// Dev cwd is apps/web, so this lands in apps/web/static/texmirror/<path>.
		const dest = join('static', 'texmirror', ...path.split('/'));
		await mkdir(dirname(dest), { recursive: true });
		await writeFile(dest, bytes);
	} catch {
		/* best-effort; capture is a dev convenience */
	}
}

/** Public maintained on-demand server — the last-resort upstream. */
const PUBLIC_UPSTREAM = 'https://texlive.texlyre.org/';

const withSlash = (u: string) => (u.endsWith('/') ? u : `${u}/`);

/**
 * Upstreams to proxy from, in order:
 *   1. `PUBLIC_TEXMIRROR_CDN` — our own curated bundle on a CDN (jsDelivr over a
 *      GitHub repo / npm package). Durable, card-free, global; 404s fast on a
 *      file it doesn't have and falls through to the next.
 *   2. `PUBLIC_TEXLIVE_ENDPOINT` — our own on-demand server, if running.
 *   3. the public TeXlyre server — last resort.
 * Every hit is buffered and written back to R2 + the edge cache (below).
 */
function upstreams(): string[] {
	return [
		...new Set(
			[env.PUBLIC_TEXMIRROR_CDN, env.PUBLIC_TEXLIVE_ENDPOINT, PUBLIC_UPSTREAM]
				.filter((u): u is string => !!u)
				.map(withSlash)
		)
	];
}

// Our vendored base bundle lives under `static/texmirror/<path>` — served from our
// own origin, never an upstream, so common compiles work fully offline /
// independent of the third party. Populate it with no extra tooling by running
// the dev server with MIRROR_WRITE=1 and compiling (see writeMirror below). A
// missing file falls through to the edge cache, then R2, then the upstreams.
const BASE_HEADERS = {
	'access-control-allow-origin': '*',
	// Files are immutable per path (a package's content is fixed for a TL snapshot).
	'cache-control': 'public, max-age=31536000, immutable'
};

const contentType = (res: Response) =>
	res.headers.get('content-type') ?? 'application/octet-stream';

export const GET: RequestHandler = async ({ params, fetch, request, platform }) => {
	const path = params.path; // e.g. "pdftex/10/swiftlatexpdftex.fmt"
	const plat = platform as Platform | undefined;
	const ctx = plat?.context;
	const r2 = plat?.env?.TEXLIVE;
	// Schedule background work without blocking the response (await in dev).
	const persist = (p: Promise<unknown>) => (ctx?.waitUntil ? ctx.waitUntil(p) : p);

	// 1. Vendored base bundle in our own static assets — guaranteed, independent
	//    of any upstream. Use the ASSETS binding on Cloudflare; fall back to a
	//    same-origin fetch in local dev (where the binding isn't present).
	const mirrorUrl = new URL(`/texmirror/${path}`, request.url).toString();
	const assets = plat?.env?.ASSETS;
	const res = await (assets ? assets.fetch(mirrorUrl) : fetch(mirrorUrl));
	if (res.ok) {
		return new Response(res.body, {
			status: 200,
			headers: { ...BASE_HEADERS, 'content-type': contentType(res) }
		});
	}

	// 2. Our Cloudflare edge cache (absent in local dev → skipped).
	const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });
	if (edge) {
		const hit = await edge.match(cacheKey);
		if (hit) return hit;
	}

	// 3. Durable R2 mirror — account-owned, free egress, survives edge eviction +
	//    deploys. Warm the fast edge cache on a hit.
	if (r2) {
		try {
			const obj = await r2.get(path);
			if (obj) {
				const headers = {
					...BASE_HEADERS,
					'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream'
				};
				// Warm the fast edge cache from the durable copy (tee so we can do both).
				if (edge) {
					const [toCache, toReturn] = obj.body.tee();
					persist(edge.put(cacheKey, new Response(toCache, { status: 200, headers })));
					return new Response(toReturn, { status: 200, headers });
				}
				return new Response(obj.body, { status: 200, headers });
			}
		} catch {
			/* R2 unavailable → fall through to upstream */
		}
	}

	// 4. Upstreams in order; first hit wins. Buffer it once, then write back to R2
	//    (durable) + the edge cache so the mirror self-populates and the upstream
	//    is never asked for this file again.
	for (const base of upstreams()) {
		let upstream: Response;
		try {
			upstream = await fetch(base + path);
		} catch {
			continue; // try the next upstream
		}
		if (!upstream.ok) continue;

		const ct = contentType(upstream);
		const bytes = new Uint8Array(await upstream.arrayBuffer());
		const headers = { ...BASE_HEADERS, 'content-type': ct };

		// Dev: also persist to the on-disk base bundle (no-op in production build).
		if (dev) await writeMirror(path, bytes);

		if (edge) persist(edge.put(cacheKey, new Response(bytes, { status: 200, headers })));
		if (r2)
			persist(
				Promise.resolve(r2.put(path, bytes, { httpMetadata: { contentType: ct } })).catch(() => {})
			);

		return new Response(bytes, { status: 200, headers });
	}

	return new Response(`TeX file not available upstream: ${path}`, {
		status: 502,
		headers: { 'access-control-allow-origin': '*' }
	});
};
