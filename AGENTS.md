# AGENTS.md

Engineering guidelines for **GlyphX** — a local-first, privacy-first **LaTeX editor**
(Tauri v2 + Rust + Svelte 5 desktop app) plus a SvelteKit web app that compiles LaTeX in the
browser. Desktop and web **share one UI**. This file is the contract every contributor follows,
**human or AI agent**. It is intentionally tool-agnostic (works with any agent that reads
`AGENTS.md`). Read it before writing code; treat the RULES as hard requirements, not suggestions.

> Per-area `AGENTS.md` files may refine (never contradict) this one.

---

## 1. Stack & layout

**Monorepo:** pnpm `10.23` + Turborepo. `"type": "module"` everywhere. Node `>=22`. TypeScript
`6.x`, strict. License **GPL-3.0-or-later**.

```
apps/
  desktop/        Tauri v2 app. Frontend: SvelteKit (adapter-static, SPA, SSR off) + Svelte 5.
                  Backend: Rust in src-tauri/ — LaTeX compile (Tectonic sidecar + System TeX),
                  engine management, Git (gitoxide), disk-backed projects, file associations.
  web/            SvelteKit 2 on Cloudflare Workers (adapter-cloudflare + wrangler). Marketing
                  site + the same editor, compiling in-browser via the SwiftLaTeX pdfTeX WASM
                  engine. NO database, NO auth, NO server user-state — local-first by design.
packages/
  ui/             @glyphx/ui — shared Svelte 5 components (shadcn-svelte + bits-ui), the shared
                  rune stores (settings, projects), and the Workbench used by both apps.
  design/         @glyphx/design — design tokens / Tailwind 4 theme (./index.css). Tokens are
                  owned by the design layer; consume them, don't hardcode values.
```

Shared frontend: **Svelte 5.56**, **SvelteKit 2.63**, **Vite 8**, **Tailwind 4.3**,
**@tabler/icons-svelte**, **shadcn-svelte**, **bits-ui**, **pdf.js** (preview). Key backend
crates: **tauri 2.x**, **gix 0.70** (pure-Rust Git), plus the pinned **Tectonic 0.16.9** sidecar.
Tests: **`cargo test`** (Rust logic) + **`svelte-check`** (types). There is no JS unit runner yet —
don't invent imports for one.

### Commands (run from repo root unless noted)

```bash
pnpm dev                         # all apps via turbo
pnpm dev:desktop | dev:web       # one app
pnpm build | check | lint | fmt  # turbo fan-out — must be green before "done"
pnpm lint:rust                   # cargo clippy across the workspace

# Desktop (apps/desktop/)
pnpm dev                         # tauri dev
pnpm check                       # svelte-check (frontend types)
pnpm test:rust                   # cargo test
pnpm lint:rust                   # cargo clippy --all-targets -- -D warnings
pnpm format:rust:check           # cargo fmt --check
pnpm tauri build                 # full bundle — ALWAYS test this, not just dev

# Web (apps/web/)
pnpm dev | build | preview       # vite
pnpm check                       # svelte-check
```

CI lives in `.github/workflows/` (`ci-desktop.yml`, `release-desktop.yml`, `deploy-web.yml`,
`refresh-texlive-bundle.yml`). The release Linux leg is built on **ubuntu-22.04 on purpose** (its
glibc is the floor for the AppImage/.deb).

---

## 2. Golden rules (non-negotiable, all languages)

1. **Match the surrounding code.** Comment density, naming, idioms, file structure. New code
   should be indistinguishable from what's already there. Don't introduce a new pattern when an
   established one exists.
2. **Surgical changes, not rewrites.** This is a maturing codebase with concurrent contributors
   (a design, a web, and a Rust persona may all be editing). **Re-read a file immediately before
   editing it** — it may have changed. Fix the thing asked; don't "modernize" untouched code.
   Preserve invariant-bearing comments — many encode hard-won platform bug history (the gix reflog
   identity gotcha, the macOS WKWebView freeze, the 0-DPI JPEG crash); deleting them re-opens bugs.
3. **One source of truth — never duplicate state.** See §3. This is a headline rule, not a detail.
4. **Validate every boundary.** All external input (IPC payloads, HTTP route params, env,
   upstream/third-party responses, file paths, the compile log) is untrusted until parsed. Parse,
   don't guess.
5. **Never swallow errors silently.** Best-effort cleanup may ignore failures *with a comment
   saying so*; a user-facing operation that fails must be logged and surfaced (the Problems panel,
   a dialog, a toast) — in plain language for non-developers, with raw detail tucked behind
   "details".
6. **No secrets in client code or git.** Only `PUBLIC_`-prefixed env reaches the browser. The Git
   access token lives in memory only — never persisted to disk.
7. **Type the contract end-to-end.** No `any`, no lying casts. `unknown` at boundaries, then
   narrow. Serialized shapes (Tauri IPC structs, HTTP JSON) are contracts — change them in lockstep
   on both sides, in the same change.
8. **Heavy work never blocks the UI/event loop.** Rust: `async fn` + `spawn_blocking` (the macOS
   rule, §4). Frontend: no synchronous heavy work on render; debounce compile-as-you-type.
9. **Design tokens only — no hardcoded colors.** No hex / named CSS colors. Use the semantic
   tokens from `@glyphx/design` (e.g. `var(--color-primary)`, `bg-muted`, `color-mix(... var(--color-destructive) ...)`).
   **@tabler/icons-svelte only** (not Lucide). The editor stays **JetBrains Mono**.
10. **Import via aliases — `@glyphx/ui/*`, `@glyphx/design`, `$lib`.** Never deep `../../..` climbs
    across package or app boundaries.
11. **Leave the gates green.** `fmt`/`format:rust`, `clippy`, `svelte-check`, and `cargo test` must
    pass before a change is "done." A red build is never a stopping point.
12. **The maintainer owns git.** Agents propose **Conventional Commit** messages (`feat(web): …`,
    `fix(git): …`) but **do not run `git commit`/`push`** — the user commits and merges. **Do not
    append `Co-Authored-By` trailers.**
13. **When unsure about a product/behavioural decision, ask** — don't guess at scope. When the
    answer is in the code or a sensible default exists, act and say what you assumed.

---

## 3. State: single source of truth & defined data flow

State bugs come from the *same fact living in two places* and drifting. The rule: **each piece of
state has exactly one owner; everything else derives from it or asks the owner.** Data moves along
defined seams — never copied sideways into a parallel field that can fall out of sync.

**Universal:**
- **Don't duplicate — derive.** If value B is a function of value A, compute B from A; never store
  both and keep them in step by hand. The moment you write code that *copies* one state into
  another, stop and derive instead.
- **Single owner per fact.** Settings are owned by the settings store; the project list by the
  projects store; on-disk truth by the Rust/`ProjectHost` layer; compile output by the compile
  flow. Other code reads through the owner, it does not keep its own copy.
- **One-directional, defined flow.** State flows owner → derived view → render (frontend), and
  command → domain service → store/disk (writes). Don't create back-channels that mutate an
  upstream owner from a downstream consumer.
- **Cross seams through the typed layer, not ad hoc.** Frontend ↔ Rust goes through the typed IPC
  client modules (`$lib/git.ts`, `$lib/compile.ts`, `$lib/project.ts`, `$lib/engine.ts`), never a
  scattered raw `invoke`. Disk/in-memory project differences hide behind the `ProjectHost` seam.
  The serialized struct is the single contract — don't keep a second hand-maintained shape.

**Frontend (Svelte 5):**
- **`$derived`/`$derived.by`, almost never `$effect`, to relate state.** Using `$effect` to write
  one `$state` from another is the canonical duplication bug — banned (§5).
  ```ts
  // ❌ let problems = $state([]); $effect(() => problems = parse(log));
  let problems = $derived(parseLatexLog(compileLog, compileError));   // ✅ one source: the log
  ```
- **Shared state lives in a `.svelte.ts` rune module** (e.g. `packages/ui/.../state/settings.svelte.ts`)
  or **Context** for per-tree state — not re-declared per component. Components read it; they don't
  mirror it into local `$state`.
- **Persisted state has one home.** A persisted setting is owned by the settings store
  (`glyphx:*` keys); don't also cache it in component locals.

**Rust:**
- **Don't hold the same data in two owners.** If the index/HEAD/worktree is the source of truth,
  read it — don't shadow it in an app-side cache that can drift. Where shared mutable state is
  unavoidable, give it one owner (`tauri::State`, an `Arc<…>`) and one update path.

**Web/SSR:** never put request/user state in a module-level global on the server (Cloudflare
Worker) — it leaks across concurrent requests *and* is a duplicate of per-request state (§6).

---

## 4. Rust / Tauri backend

The desktop backend drives external toolchains (Tectonic, latexmk, system `git`) and child
processes; it is concurrency- and platform-sensitive.

### Subprocess & tooling
- **Every external spawn goes through `subprocess::CommandExt::no_window()`** — on Windows a child
  console flashes and steals focus, reading as "the app froze." This is the GlyphX equivalent of a
  silent-command helper; use it for `tectonic`, `latexmk`, `git`, `reg`, etc.
- **Resolve the Tectonic binary in the defined order** (`GLYPHX_TECTONIC_BIN` → managed engine →
  bundled sidecar → PATH). The sidecar is an `externalBin`; `tauri::generate_context!` validates it
  exists per target triple at compile time — keep the per-triple names correct.
- **The compile engine is pluggable** (`tectonic` | `system`/latexmk). Keep the dispatch in
  `run_engine`; both paths funnel through the shared best-effort-PDF assembler. When you recognise
  an engine-specific failure (biber/biblatex skew, 0-DPI JPEG), surface an actionable `hint`, don't
  just dump the raw log.
- **Don't present partial output as valid** — a hard-killed/aborted compile that produced no PDF is
  a failure; detect it, don't guess from file size.

### Git (gitoxide + system git)
- **Local ops are pure-Rust gix** (status/stage/commit/discard/log/clone). Keep them dependency-free
  of system `git`. **Remote ops** (push/pull/sync/remote management/ahead-behind) shell out via
  `run_git` — guarded by `git_available()` so the UI degrades to a plain-language "install Git"
  message rather than a raw spawn error.
- **gix `commit_as` stamps the reflog from the *configured* committer**, not the passed signature —
  seed `user.name`/`user.email` into the config snapshot before committing or it fails on an
  identity-less machine (CI). Don't remove that seeding.
- **The access token is in-memory only** and travels in the push/pull URL — never written to disk
  or logged.

### State & concurrency
- **Pick the cheapest correct primitive per field** — read-mostly → `RwLock`; a flag →
  `AtomicBool`; set-once → `OnceLock`; genuinely-mutable shared map → `Mutex`. Don't default
  everything to `Mutex`.
- **Never hold a lock across `.await`, blocking I/O, or a process spawn.** Lock → copy the minimal
  data into a local → drop the guard → do the slow work.
- **Owned threads/child processes get RAII teardown** (signal stop + join/kill on `Drop`) so a
  panic or early `?` can't orphan a compile child or a worker thread.

### Tauri command layer
- **The macOS rule:** sync Tauri commands run on the main thread and freeze the macOS WKWebView
  (Windows WebView2 masks it). Any command doing heavy CPU / blocking I/O / a process spawn MUST be
  `async fn` (Tauri runs async commands off the main thread). Trivial in-memory getters may stay
  sync.
- **Commands are thin IPC adapters:** deserialize → call a domain function → map error → return.
  Keep arg-building / git plumbing / zip logic in `AppHandle`-free, unit-testable module functions
  (this is also what keeps the logic `cargo test`-able and automation-ready).
- **Serialized IPC structs are a contract.** GlyphX mirrors them **field-for-field in the TS types**
  (`CompileResult` ↔ `RawCompileResult`, snake_case on both sides). Tauri auto-converts *command
  argument* names (camelCase call ↔ snake_case param); **returned struct fields are NOT auto-renamed
  — keep the TS type identical.** Renaming a field means updating the TS side in the same change.
- **Surface errors as data the UI can branch on** (a typed result/`hint`), not a lossy
  `.to_string()` that throws away the cause chain.

### Persistence & platform
- **Atomic file writes:** write to a temp file in the same dir → flush → `rename` over the target.
  Never truncate-then-write a file the app reads on next launch (`.glyphx` manifest, project files).
- **New disk projects are created in the app data dir by default** (no save prompt); Import / Open-
  folder remain. Don't delete user-imported folders on "remove from list."
- **`#[cfg(target_os)]` stays behind a boundary** (e.g. `shell_integration.rs` keeps the Windows
  registry code `#[cfg(windows)]` with a no-op elsewhere). Don't leak `cfg` blocks into shared
  domain/command code; **all target trees must compile.**

### Verify (from `apps/desktop/src-tauri/`)
`cargo fmt --check` · `cargo clippy --all-targets -- -D warnings` · `cargo test` · plus `cargo
check` the host target and reason through the `cfg` branches for the others. The CI compile gate
runs all three OSes.

---

## 5. Frontend — Svelte 5 + SvelteKit 2

Runes era — no Svelte 4 idioms in new code. Shared by desktop and web via `@glyphx/ui`.

### Runes & reactivity
- **`$state` only for genuinely reactive values**; plain `let` otherwise (proxies cost).
- **Derive, don't sync — `$derived`/`$derived.by`, almost never `$effect`.** `$effect` is for
  analytics/logging/DOM/3rd-party sync only; **never use it to write one `$state` from another**
  (that's the duplication bug from §3).
- **`$state.raw`** for large immutable blobs (PDF bytes, parsed docs) — reassign, don't mutate.
- **`$state.snapshot(x)`** before handing reactive state to non-Svelte APIs (**Tauri `invoke`**,
  `structuredClone`, serializers) — proxies don't serialize.
- **Reactive collections** from `svelte/reactivity` (`SvelteMap`/`SvelteSet`), not native `Map`/`Set`.

### Components
- **Snippets + `{@render}`, never `<slot>`.** Default content is `children`.
- **Callback props, never `createEventDispatcher`.** Events are function props (`onsave`,
  `onopendiff`). DOM events are attributes (`onclick`, not `on:click`).
- **Type props with `interface Props`**; snippets as `Snippet<[Args]>`. Two-way binding only when
  the child opts in via `$bindable()` — prefer callback props.

### State management
- **Local `$state` by default; shared logic → a `.svelte.ts` rune module** (export an object/class
  and mutate it — don't `export let x = $state()` and reassign across files). **Context** for
  per-tree shared state, not globals. (See §3 — one owner per fact.)
- Settings live in the `@glyphx/ui` settings store (`glyphx:*` PersistedState keys: engine kind,
  tex program, shell-escape, auto-compile, git view, diff view, …). Read them; don't re-cache them.

### Desktop (Tauri, adapter-static SPA)
- **SSR off, no prerender** (`export const ssr = false; export const prerender = false`) — Tauri has
  no server; SPA `load` runs in the webview where `invoke` works. No `*.server.ts` / `+server.ts` in
  the desktop app.
- **Typed per-domain IPC clients** wrap `invoke` (`$lib/git.ts`, `compile.ts`, `project.ts`,
  `engine.ts`); never scatter raw `invoke('cmd', …)`. Mirror the Rust command signatures in TS.
  **Always test `tauri build`,** not just `dev`.
- The disk/in-memory project split hides behind the **`ProjectHost`** seam — feature code talks to
  `ProjectHost`, not to `invoke` directly.

### Project conventions
- **Design system:** shadcn-svelte components + `@glyphx/design` token CSS variables. **No
  hardcoded colors. @tabler/icons-svelte only. JetBrains Mono in the editor.**
- **bits-ui wrappers** (Dialog/Sheet/Dropdown/Select/Popover) — match the existing wrappers'
  conventions (e.g. `showCloseButton`, `interactOutsideBehavior`) rather than re-styling inline.
- `.svelte.ts` for rune logic, `.svelte` for components. **`svelte-check` clean is a merge gate.**

### Anti-patterns to ban
`$effect` to sync/duplicate state · mutating non-`$bindable` props · server-side module-global
request state · deep reactive `$state` for large blobs (use `$state.raw`) · `$:` / `export let` /
`createEventDispatcher` / `<slot>` / `on:event` / `$app/stores` in new code · raw scattered
`invoke` · hardcoded colors · non-Tabler icons.

---

## 6. Web app — SvelteKit on Cloudflare Workers

The web app is **local-first and backend-light**: a marketing site plus the same editor compiling
in the browser. It deploys to **Cloudflare Workers** via `@sveltejs/adapter-cloudflare` (SSR worker
+ static assets; `wrangler.jsonc`). **There is no database, no auth, and no server-side user
state** — don't add Vercel/Hono/Drizzle/Postgres-shaped patterns; if a real backend is ever needed
it gets its own per-area `AGENTS.md`.

### Server routes (run on the CF Worker)
- Server endpoints run in the **Workers runtime** (not Node) — use Web APIs; Node built-ins only
  via `nodejs_compat`, and only in code paths that never run on the edge. Gate any dev-only
  filesystem code behind `dev` from `$app/environment` so it's **stripped from the production
  build** (the Worker FS is read-only).
- **No module-scope request/user state.** Module scope is for constants and (cross-request-safe)
  caches only — never per-user data (it leaks across requests; see §3).
- The **`/texlive` route** is the canonical pattern: resolve each file (1) vendored bundle under
  `static/texmirror/` via the **ASSETS binding**, (2) the **Cloudflare edge cache** (`caches.default`,
  immutable per path, `waitUntil` the `put`), (3) upstreams (`PUBLIC_TEXLIVE_ENDPOINT` → public
  fallback) — caching the result. The engine only ever talks to our own origin; the third party is
  a cached backend, not a hard dependency.

### Service worker & caching
- `src/service-worker.ts` precaches `build + files` (the app shell + the engine WASM) but
  **excludes `/texmirror/*`** (that's the route's server-side source, not a client preload).
- The downloaded compiler (TeX format + packages) lives in a **separate, deploy-independent cache
  (`glyphx-texlive`)** that `activate` must NOT delete — so updates never wipe the installed
  compiler. App shell is network-first; immutable assets are cache-first.

### In-browser engine (GlyphX — Tectonic/XeTeX WASM)
- The engine is **ours**: Tectonic (XeTeX + xdvipdfmx) compiled to WebAssembly in
  `crates/tectonic-wasm`, wrapped by `packages/tex-engine`. SwiftLaTeX is **gone** — do not
  reintroduce it or `static/swiftlatex/`.
- Served self-hosted from `static/engine/` (`tectonic_wasm.wasm` + `tectonic-bundle.tar.gz`,
  staged by `pnpm engine:web:sync`, never committed there). Runs in a Web Worker; **no
  SharedArrayBuffer, so no COOP/COEP headers**. Unlike SwiftLaTeX it needs no synchronous XHR, so
  it runs headless in Node — which is how the e2e suites test it.
- First-run is gated by a **required install dialog** (download + persistent Cache API, keyed on
  the manifest content hash so a new engine invalidates the old install); compiling is blocked
  until it completes. Don't auto-compile into a cold engine.
- **A compile that aborts poisons the instance.** The wasm stack is torn down without unwinding
  Rust, so the session lock is never released; the binding raises `EnginePoisonedError` and the
  caller must discard the engine and rebuild it (`worker.ts` retries once). Never reuse an engine
  after that error.
- **Coverage is bounded by the bundle**: it contains what `packages/tex-engine/test/fixtures/
  groups.mjs` needs and nothing more, so an unlisted package fails as a missing file. There is no
  on-demand fetch. Widening coverage means widening the fixtures and rebuilding the bundle.

### Boundaries & security
- **`PUBLIC_`-only env in the browser**; no secrets client-side. Validate untrusted input
  (route params, upstream responses, storage keys — reject `..`/absolute paths).
- CSP is currently `null` in the desktop config and not yet tightened on web — treat tightening it
  as a deliberate, tested change (the pdf.js worker + engine worker must keep working), not a
  drive-by.

---

## 7. Definition of done

A change is done when, for every area it touched:

- [ ] Behaviour-preserving (or an explicitly-intended, stated change).
- [ ] **No duplicated state** — one owner per fact, consumers derive; state crosses seams through
      the typed layer (§3).
- [ ] Boundaries validated; errors surfaced in plain language (not swallowed); no secrets client-side.
- [ ] Types intact end-to-end; serialized contracts updated on **both** sides in the same change.
- [ ] Gates green: `format:rust`/`clippy` (Rust), `svelte-check`, `cargo test`, `pnpm check`/`build`.
- [ ] (Rust) all `target_os` trees compile; spawns go through `no_window()`; new threads/processes
      have RAII teardown; heavy commands are `async`/off the UI thread.
- [ ] (Frontend) no banned Svelte 4 idioms; `@glyphx/design` tokens + Tabler icons only; JetBrains
      Mono preserved; `tauri build` tested if desktop runtime behaviour changed.
- [ ] (Web) Workers-runtime-safe; no module-scope request state; dev-only/Node code stripped from
      the build; the persistent TeX cache not wiped on deploy.
- [ ] Conventional Commit message proposed; **no commit/push run by the agent**; no `Co-Authored-By`
      trailer; the maintainer owns the merge.

---

*Keep this file current. When a convention changes, update the rule here in the same change so the
guidance never drifts from the code.*
