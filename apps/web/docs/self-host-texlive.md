# Self-hosting the TeX Live package server (web compile)

GlyphX's **web** build compiles LaTeX in the browser with the SwiftLaTeX pdfTeX
WASM engine. The engine itself is self-hosted (`apps/web/static/swiftlatex/`),
but it fetches the format file + every package **on demand** from a TeX Live
"on-demand" server.

## How requests flow (you rarely need to think about the upstream)

The engine never talks to a third party directly. It fetches everything from our
**own same-origin route**, `/texlive/...`
(`apps/web/src/routes/texlive/[...path]/+server.ts`), which resolves each file:

1. a **vendored copy** in `static/swiftlatex/` (e.g. the format dump — run
   `node scripts/dev/fetch-texlive-base.mjs` to vendor it), then
2. our **Cloudflare edge cache** (immutable per path — fills itself on first use),
   then
3. an **upstream** on-demand server, whose response we cache at our edge.

So the upstream is a _cached backend behind our domain_, not a hard dependency:
once a file is cached at our edge (or in the per-device service-worker cache) it
keeps serving even if the upstream is down. The browser only ever sees our origin.

The upstream list (used only by the route, server-side) is, in order:

1. **`PUBLIC_TEXLIVE_ENDPOINT`** — your own server (this guide), tried first.
2. **`https://texlive.texlyre.org/`** — public maintained fallback (third-party,
   slower, no uptime guarantee).

For **full** independence from any third party, host your own (below) and set
`PUBLIC_TEXLIVE_ENDPOINT`; our edge then just caches it.

## Vendoring a base bundle (the hybrid's "works offline / no upstream" half)

The edge route serves any file present under `apps/web/static/texmirror/<path>`
straight from our own assets — no upstream involved.

### Recommended: self-populating mirror (no extra tooling)

The `/texlive` route already proxies every file the engine requests, so in dev it
can persist them to the bundle itself — no browser automation, no Chromium
download, no `sudo apt`. Just compile in your own browser with the flag on:

```sh
MIRROR_WRITE=1 pnpm --filter @glyphx/web dev
# then open /editor, run the install (or compile a representative document).
# Every fetched file is written to apps/web/static/texmirror/ as it streams.
```

Compile a doc that exercises the packages you care about (math, figures, tables,
links) so their files are captured. Commit `static/texmirror/` afterwards
(consider **Git LFS** — the format dump is ~10 MB).

For the format dump alone, browser-free:
`node scripts/dev/fetch-texlive-base.mjs`.

### Optional: headless capture (`scripts/dev/capture-texlive-base.mjs`)

A Playwright driver that runs the install compile headlessly — only if you want
to fully automate the refresh (e.g. in CI). It needs Playwright + a browser, so
the self-populating route above is the lighter/safer default.

With the bundle in place, common documents compile fully from our own origin even
if every upstream is down; uncommon packages still fall back to your dedicated
server / the public one, and get edge-cached. That's the hybrid: **base bundle in
our Worker + your dedicated server for the long tail.**

## Why self-host

- **Free.** A Cloudflare Tunnel costs nothing; you only need a machine that's on
  when you want your endpoint serving (your dev box, a homelab box, a small VPS).
  When it's off, the app falls back to the public server automatically.
- **Reliable + fast.** Cloudflare caches responses at the edge; you're not at the
  mercy of a shared public server.
- **Private.** Package requests hit your own infra.

## Setup (Docker + Cloudflare Tunnel)

Uses [TeXlyre/texlive-ondemand-server](https://github.com/TeXlyre/texlive-ondemand-server)
(an adaptation of SwiftLaTeX's server made deployable with Cloudflare Tunnel).

1. On the host machine (Docker + a Cloudflare account with `nexonauts.com` as a
   zone):

   ```sh
   git clone https://github.com/TeXlyre/texlive-ondemand-server
   cd texlive-ondemand-server
   cp envfile .env   # then edit: set HOST_DOMAIN, PORT, CLOUDFLARE_API_KEY
   ```

2. Pick the subdomain for the tunnel, e.g. `texlive.glyphx.nexonauts.com`, and
   run the Cloudflare-tunnel compose:

   ```sh
   chmod +x ./scripts/run_texlive_cloudflare_tunnel.sh
   source ./.env && ./scripts/run_texlive_cloudflare_tunnel.sh "$CLOUDFLARE_API_KEY" "$HOST_DOMAIN" "$PORT"
   ```

   This builds the image, starts the server, and provisions the tunnel +
   DNS/cert for your subdomain.

3. Verify it serves the format file (≈10 MB) and a package, with CORS:

   ```sh
   curl -I https://texlive.glyphx.nexonauts.com/pdftex/0/swiftlatexpdftex.fmt
   curl -I https://texlive.glyphx.nexonauts.com/pdftex/26/article.cls
   # expect: 200, and Access-Control-Allow-Origin in the headers
   ```

4. Point GlyphX at it — set in the deploy host (Cloudflare Worker var) or `.env`:

   ```sh
   PUBLIC_TEXLIVE_ENDPOINT=https://texlive.glyphx.nexonauts.com/
   ```

That's it. Leave it unset to use the public fallback only.

## Notes

- The request protocol is `GET <endpoint>pdftex/<kpathsea-format>/<filename>`
  (and `pdftex/pk/<dpi>/<filename>` for bitmap fonts). The server must send CORS
  headers (TeXlyre's already does via `flask-cors`).
- The on-demand server resolves files from a local TeX Live install via
  kpathsea, so the host needs TeX Live available (the image handles this).
- Engine JS + WASM stay self-hosted in this repo — a CDN can't be the source of
  truth (the official SwiftLaTeX repo ships no built engine, and cross-origin
  Web Workers are blocked by the browser), and self-hosting keeps them working
  offline via the service worker.
