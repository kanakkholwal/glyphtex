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
import { dev } from '$app/environment';

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

// Our vendored base bundle lives under `static/texmirror/<path>` — served from our
// own origin, never an upstream, so common compiles work fully offline /
// independent of the third party. Populate it with no extra tooling by running
// the dev server with MIRROR_WRITE=1 and compiling (see writeMirror below). A
// missing file falls through to the edge cache, then the upstreams below.
const BASE_HEADERS = {
	'access-control-allow-origin': '*',
	// Files are immutable per path (a package's content is fixed for a TL snapshot).
	'cache-control': 'public, max-age=31536000, immutable'
};

const contentType = (res: Response) =>
	res.headers.get('content-type') ?? 'application/octet-stream';

export const GET: RequestHandler = async ({ params, fetch, request, platform }) => {
	const path = params.path; // e.g. "pdftex/10/swiftlatexpdftex.fmt"

	// 1. Vendored base bundle in our own static assets — guaranteed, independent
	//    of any upstream. Use the ASSETS binding on Cloudflare; fall back to a
	//    same-origin fetch in local dev (where the binding isn't present).
	const mirrorUrl = new URL(`/texmirror/${path}`, request.url).toString();
	const assets = (platform as { env?: { ASSETS?: { fetch: typeof fetch } } } | undefined)?.env
		?.ASSETS;
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

	// 3. Upstreams in order; first hit wins and is cached at our edge.
	for (const base of upstreams()) {
		let res: Response;
		try {
			res = await fetch(base + path);
		} catch {
			continue; // try the next upstream
		}
		if (!res.ok) continue;

		// In dev with MIRROR_WRITE=1, buffer + persist to the on-disk bundle. In
		// production this is a no-op, so we stream through without buffering.
		if (dev && typeof process !== 'undefined' && process.env?.MIRROR_WRITE === '1') {
			const bytes = new Uint8Array(await res.arrayBuffer());
			await writeMirror(path, bytes);
			return new Response(bytes, {
				status: 200,
				headers: { ...BASE_HEADERS, 'content-type': contentType(res) }
			});
		}

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
