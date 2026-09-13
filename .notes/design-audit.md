# Design audit: GlyphTeX vs. the Orbit system (Sept 2026)

Measured against [DESIGN.md](DESIGN.md), which ports Orbit / Rune Icons with GlyphTeX's blue accent.
Contrast is WCAG 2.x relative luminance; colour-blind separation is OKLab dE under simulated CVD.
Status: **Fixed** in this pass, **Open** still to do, **Decided** where a trade-off was chosen.

Ids: `T`/`Y`/`S`/`L`/`F` lead (tokens, type, surface, landing, friction), `WP` web public pages,
`WW` web workspace, `DK` desktop, `UA` shared application components, `UP` shared primitives.

## Verification at the end of the pass

| Gate | Result |
| --- | --- |
| `svelte-check` web | 0 errors, 0 warnings after building `glyphtex-engine` (`tsc`) and staging the wasm, bundle and 12 packs with `pnpm engine:sync`. The wasm itself was not recompiled from Rust (needs emsdk) |
| `pnpm --filter @glyphtex/desktop check` | 0 errors, 0 warnings (baseline 0) |
| `pnpm --filter @glyphtex/web test` | 96 / 96 pass (the `text-flip` test left with its deleted module) |
| `pnpm --filter @glyphtex/ui test` | 191 / 191 pass |
| `biome format` + `biome lint` (whole repo) | clean; format only rewrote line endings outside the 232 intended files |
| Dash + comment gate on every changed file | clean except pre-existing dashes in `AGENTS.md` prose and the `"image/*"` false positive |
| Dev server, 18 routes | all 200 with exactly one `h1`; unknown path 404 |
| Illustrations | `LocalCompile`, `RevisionStack` rendered to PNG (sharp) in light and dark and inspected |
| Browser | **Not run.** Nothing was viewed in a real browser or in `tauri dev` / `tauri build` |

## Next steps (Open, in priority order)

1. **Security, desktop Rust (DK29-DK33, DK40):** scope `project.rs` file commands to opened roots
   (`delete_path` is `remove_dir_all` on any path), pass `--` and reject option-like git args in
   `git.rs`, disable imported hooks and `core.fsmonitor`, reject `..` in `git_discard`/`git_stage`,
   set a CSP, move blocking gix and process work into `spawn_blocking`.
2. **Decide DK26:** deleting a project from the desktop home removes cloned and opened folders from
   disk, which AGENTS.md forbids for imported folders. Proposed: "Remove from list" for those.
3. **Secrets (DK36):** clone stores the token URL in `.git/config` and exposes it in process argv.
4. **Honesty in content (WP17, UA-33):** blog markdown stats ("~15 MB engine", "under a minute") and
   the About dialog's invented `0.1.0` default.
5. **Drift (T15, T14):** root `DESIGN.md` documents Framer, not GlyphTeX; `packages/design` is unused.
6. **Accessibility debt (UP-34, UP-35, UP-36):** nested button in `PanelSection`, no arrow keys in
   `Segmented`, `SliderControl` value unreachable by keyboard.
7. **Type scale for the visual editor (UA-26)** and brand preset UI (T13).
8. **Analytics (L11):** dashboards reading the old landing section names need the new ones.
9. **Dependencies (UP-32):** drawer wrappers target vaul-svelte 1.x but 0.3.2 is installed.

## 1. Colour and tokens

| id | finding | kind | status |
| --- | --- | --- | --- |
| T1 | **Overloaded token:** `--primary` was near-black ink (buttons, checkbox, logo badge, resize handles) while the real accent lived in `--brand`; 35+ `bg-primary` sites meant two different things | token model | Fixed: `--primary` is the accent, `--action` is ink; ink call sites moved to `bg-action` |
| T2 | Brand `oklch(0.52 0.17 250)` was outside sRGB (clipped to `#006ac5`); dark brand measured 6.61:1 on `#191919` but its label rule was ad hoc | gamut | Fixed: in-gamut `#025eb8` (6.37:1 white, 5.84:1 canvas, 5.48:1 on /10 tint) and `#59aaf8` (8.04:1 on `#0a0a0a`) |
| T3 | `--ink-muted` `#9e9e9e`: 2.68:1 on white, 2.46:1 on canvas | contrast | Fixed: aliases muted ink `#6b6b6b` (5.33 / 4.89) |
| T4 | `--faint` `#6f6f6f` 4.36:1, `--ink-muted-strong` 4.32:1, destructive 4.13:1, success 4.45:1 on the `#ebebe9` sidebar accent and `#efefed` strong surface | contrast | Fixed: Orbit neutrals; muted 4.63:1 and success 4.52:1 on `#efefef` |
| T5 | Dark `--ink-muted` `#8f8f8f` 4.14:1 on `#2f2f2f` | contrast | Fixed: `#a1a1a1` 5.18:1 |
| T6 | `--input` `#f5f5f5` was a field fill: 1.09:1 boundary; checkbox and radio borders on the hairline 1.25:1; switch off-track `bg-border` | control boundary | Fixed: fields `bg-background` + border; checkbox, radio, switch-off use `--placeholder` (4.95:1) |
| T7 | Orbit's `--info` `#0060c9` would sit 0.027 OKLab dE from the blue accent under every CVD type | CVD | Decided: cyan `#00627a` / `#5ac8dc` (0.10 dE, tritan 0.055; glyph rule applies) |
| T8 | Orbit's `--placeholder` `#737373` measures 4.35:1 on a muted field (launcher search) | contrast | Fixed: `#707070` (4.95 white, 4.54 muted) |
| T9 | Three parallel vocabularies (`--ink*`, `--surface*`, `--hairline*`, `--brand*`, `--signal-*`, `--brand-gradient`); `--signal-*` and `--brand-gradient` had 0 usages | debt | Fixed: dead ones removed, the rest alias Orbit roles; call-site migration assigned to domain owners |
| T10 | The ease curve `cubic-bezier(0.625, 0.05, 0, 1)` hardcoded in 22 places | debt | Fixed: one `--ease-craft` / `ease-craft` |
| T11 | `@custom-variant dark (&:is(.dark *))` never matched `<html class="dark">` itself | correctness | Fixed: `&:where(.dark, .dark *)` |
| T12 | No `prefers-contrast` or `prefers-reduced-transparency` handling | a11y | Fixed: stronger hairlines; backdrop blur dropped |
| T13 | Brand panel needed as CSS derived from the accent | token | Fixed: `panel-brand` from `--brand-panel`; 7 light/dark presets via `data-brand`, all >=4.5:1. No preset UI yet: **Open** |
| T14 | `packages/design` is an unused second token file | debt | **Open** (AGENTS.md already says unused; delete when agreed) |
| T15 | Root `DESIGN.md` documents Framer's marketing site, not GlyphTeX | drift | **Open: decide** (replace with a pointer to `.notes/DESIGN.md`) |
| T16 | Dark IDE surfaces (`#191919` family) are baked into the CodeMirror theme | token model | Decided: kept as the `workbench-surface` scope; public and home surfaces use Orbit `#0a0a0a` / `#171717` |

## 2. Typography

| id | finding | kind | status |
| --- | --- | --- | --- |
| Y1 | Geist display + Quicksand "serif" + Geist Mono UI; no heading face | type | Fixed: Google Sans (h1-h6), Inter, Source Code Pro via Fontsource; JetBrains Mono stays in the editor |
| Y2 | **Latent bug:** tailwind-merge did not know `text-md`, so `cn("text-md text-foreground")` silently dropped the size; `tv()` variants had the same blind spot | correctness | Fixed: `twMergeConfig` registers roles, `text-md`, legacy shadows and radii; passed to `tv()` in button and badge |
| Y3 | Ad hoc display sizes: `clamp(2.75rem, ..., 5rem)`, `text-[2.5rem]`, `tracking-[-0.025em]` | type | Fixed on landing and error; legacy `landing-*` classes retokened to roles |
| Y4 | 79 `text-[Npx]` in 38 files; 51 text tokens faded with opacity in 30 files | type, contrast | Assigned to domain owners (see their sections) |

## 3. Surface, depth and motion

| id | finding | kind | status |
| --- | --- | --- | --- |
| S1 | Radii 12/16/20 vs the system's 14/18/22 | shape | Fixed |
| S2 | `Card` carried `shadow-sm` at rest (`editorial` `shadow-craft-lg`); `landing-shot` used a 4-layer Notion shadow | depth | Fixed: hairline cards, no shadow at rest |
| S3 | Button default CTA 36px, scale 0.97, `border-border/40` faint outline on every variant | Fitts | Fixed: 40/44/48px CTAs, 0.98 press, 2px ring with offset; `sm`/`xs` kept for workbench density |
| S4 | `GLASS_PANEL` (raw white/black + blur), `BLOCK_HOVER` (hover scale), `CRAFT_TRANSITION` (`transition-all`), `INVISIBLE_UI`, `CRAFT_EASE`: exported, 0 consumers | dead code | Removed |
| S5 | Landing FAQ used `transition:slide` gated by a `reducedMotion` constant read once at module load | motion | Fixed: bits-ui accordion with measured height, CSS guard applies |
| S6 | `CountUp` must not animate under reduced motion and must SSR the real number | motion | Fixed: renders the real value in SSR, counts only after hydration, `matchMedia` check |

## 4. Landing and public shell

| id | finding | kind | status |
| --- | --- | --- | --- |
| L1 | "Compile locally in milliseconds" had nothing behind it | honesty | Removed |
| L2 | "Step 3 · Track" showed a commit list with invented hashes and dates as if real | honesty | Removed; history shown as an illustration |
| L3 | No real numbers anywhere | honesty | Fixed: live GitHub stars (server fetch, 1.5s timeout, edge-cached 1h, hidden when unavailable, streamed so the hero never waits), LaTeX commands documented (floored to 50 with "+"), packages completed, guides count; all from the repo |
| L4 | 11 bands, three near-identical step panels, a pain-point grid and a tech-logo strip before the FAQ | Hick | Fixed: six rows: hero, try the editor, guide search, bento, FAQ, CTA |
| L5 | Hero and nav both used near-black; no single brand action | Von Restorff | Fixed: hero `primary` + `default`; nav `default` |
| L6 | No skip link on public pages; `<main>` not focusable | a11y | Fixed in `RailFrame` (landing, error). Inner pages: web-public owner |
| L7 | No way to find help though 12 guides exist | findability | Fixed: Explore-style guide search on its own prerendered `/errors` page (a help tool doesn't belong in the pitch), linked from the footer and the landing FAQ |
| L12 | "Type in it" put the drop zone in the 440px title column, so its copy wrapped one word per line, and the editor footer repeated the heading | layout, copy | Fixed: title and lede side by side, editor and drop zone full width. Drop zone container query and editor footer copy: web-workspace owner |
| L8 | Error page: `text-[2.5rem]`, italic `font-serif` tagline at `/55` opacity (fails 4.5:1), a `landing-bg-grid` class that doesn't exist, 11px mono chip | type, contrast, debt | Fixed: `ErrorState` in `RailFrame`; 404 lists real pages (the hidden desktop download is not linked) |
| L9 | Mobile menu rows 40px; footer social icons 36px | Fitts | Fixed: 44px rows, 40px icons |
| L10 | Web had no boot splash; desktop's pulsed a gradient mark on hardcoded `#fafbfc` / `#0a0a0c` with no fallback if the app never mounted | loading | Fixed: Orbit splash in both, token-matched, 150ms delay, 8s self-dismiss; web shows it on `/workspace` only so SSR pages are not hidden |
| L11 | Analytics section names changed with the new sections (`hero`, `try`, `guides`, `features`, `faq`, `final_cta`) | analytics | **Open:** update any dashboard that reads `why`, `open`, `compile`, `track`, `audience`, `institutions` |

## 5. UX friction (landing)

Personas: PhD student moving a thesis off Overleaf (goal-driven), student with a compile error from search (time-pressed), lab IT evaluating for a cohort (explorer).

| id | friction | users | severity | fix | status |
| --- | --- | --- | --- | --- | --- |
| F1 | Import path buried under the hero among four assurance chips and a dropzone | Goal-driven | 6 | Import sits beside the live editor in "Type in it before you commit" | Fixed |
| F2 | A visitor with a LaTeX error lands on marketing with no route to the fix | Time-pressed | 7 | Guide launcher on the landing, `Enter` opens the top match | Fixed |
| F3 | Institution answers spread across a stats block, six cards and a mailto band | Explorer | 4 | One FAQ answer plus "Talk to us about a campus" beside the FAQ title | Fixed |
| F4 | Every section animated in on scroll (Reveal + stagger) | All, vestibular | 3 | Static rows; motion only in illustrations, gated by reduced motion | Fixed |

## 6. Web public pages audit

Scope: about, download, engine, privacy, docs, blog routes, `lib/content`, `lib/seo`, `llms.txt`, legacy landing files, `motion-core`, `FloatingGlyphs`.

| id | finding | kind | status |
| --- | --- | --- | --- |
| WP01 | All nine public pages rendered SiteHeader/SiteFooter directly with legacy `Container`/`Section`; now `RailFrame` > `RailRow` > `PageHero`/`SplitSection`/`panel-card`, ending in `BrandPanel` on about, download, engine, docs index, blog index | ux | Fixed |
| WP02 | `text-3xl/4xl/lg/sm/xs`, `text-[10px]`, `text-[0.9375rem]`, `md:text-[2.75rem]`, `leading-[1.05]` across pages and content components; replaced with type roles | type | Fixed |
| WP03 | `bg-surface-*`, `border-hairline`, `text-ink`, `bg-brand/4`, `landing-*` classes, `shadow-craft-*` at rest, `hover:-translate-y-1 hover:shadow-craft-lg` lifts on download cards | token | Fixed |
| WP04 | `text-foreground/70`, `/85`, `/90`, `text-muted-foreground/60`, `opacity-70` on text | token | Fixed |
| WP05 | `prose.ts` used Tailwind greys, `prose-pre:bg-[#0d1117]`, foreground links; now `--tw-prose-*` pointed at tokens, 16px/1.75, max 48rem, blue links, counters and bullets, focus ring on links | token | Fixed |
| WP06 | Engine page "~600 ms typical recompile" had no benchmark in the repo | honesty | Fixed (removed) |
| WP07 | Engine page "1,534 TeX files bundled" did not match the current bundle (1,467 in `tectonic-bundle.tar.gz`); replaced with measured 1,467 files, 12 packs; 1.07 MB brotli re-measured (1,126,985 B) | honesty | Fixed |
| WP08 | Engine page "458 calls", "414-line wrapper", "zero stars" were not traceable to anything in the repo | honesty | Fixed (reworded without numbers) |
| WP09 | Download page said every release lists checksums next to artifacts; `release-desktop.yml` publishes none and installers are not OS code-signed | honesty | Fixed |
| WP10 | macOS quarantine command hardcoded `/Applications/GlyphTeX.app`; the only published builds (v0.0.2) are named `GlyphX`, so the command did nothing. Now derived from the release asset name | honesty | Fixed |
| WP11 | Download hero now states "The desktop app is an unmaintained prototype" in the h1; no release date promised; dead Homebrew branch (`showHomebrew = false`) removed | honesty | Fixed |
| WP12 | Privacy page said "you can switch it off below" but no control existed; added a switch wired to `setOptedOut`/`hasOptedOut`, with an honest "not configured" state | honesty | Fixed |
| WP13 | Privacy event table: `section_viewed` said home page only, `document_created` sources omitted "template" | honesty | Fixed |
| WP14 | About page promised "a desktop app for full offline work"; now says the desktop app is an early, unmaintained prototype | honesty | Fixed |
| WP15 | `llms.txt` described the desktop app as "offline LaTeX for Windows, macOS, Linux" and claimed "Runs fully offline"; now prototype wording and "offline once the engine is downloaded" | honesty | Fixed |
| WP16 | Blog index and tag cards showed "0 min read": `listPosts()` reads `readingMinutes` from frontmatter, which no post sets. PostCard now hides it at 0; computing it belongs in `lib/server/content.ts` | honesty | Fixed (lead): computed from the article text in `listPosts()` |
| WP17 | Blog markdown stats are unsourced or wrong: "~15 MB :: Engine, cached once" (wasm 3.6 MB + bundle 16 MB gz), "in under a minute", "Unlimited :: Collaborators via Git" (`apps/web/content/blog/*`, outside this scope) | honesty | Open |
| WP18 | Svelte `in:fly` on download and engine heroes and `Reveal` wrappers bypassed the reduced-motion guard; removed | a11y | Fixed |
| WP19 | Blog index/tag/related grids jumped h1 to h3 (PostCard); added h2 "Latest articles", "Articles", "Keep reading". macOS steps h4 under h2 now h3 | a11y | Fixed |
| WP20 | Links and chips under 40px (tag pills, TOC, docs nav, back links, author socials, copy button); now `min-h-10`/`size-10` with `focus-visible:ring-2 ring-ring` | a11y | Fixed |
| WP21 | Offline column and limits used icon colour alone; now "Yes"/"No" and "Works"/"Does not work" words, "Your platform" chip has text, current tag has `aria-current` plus weight | a11y | Fixed |
| WP22 | Docs article nav vanished below `lg`; added a "Browse the docs" disclosure for small screens (progressive disclosure) | ux | Fixed |
| WP23 | Engine and download heroes had two near-black/outline CTAs and download cards used a blue fill per platform; one `primary` per view now | ux | Fixed |
| WP24 | `Mermaid.svelte` ids from `Math.random()`; now `$props.id()`. mermaid stays behind a dynamic import on intersection | perf | Fixed |
| WP25 | Legacy `Container`, `Section`, `ShowcasePanel`, `PolishGrid`, `EditorMock`, `ContainerTextFlip`, `landing/index.ts`, `tech-logos.ts`, `text-flip.ts` (+ `test/text-flip.test.mjs`, `pretest` entry) unused after migration; deleted. `pnpm test` 96/96 | debt | Fixed |
| WP26 | `lib/motion-core/**` (CardStack, FloatingMenu, SplitReveal, gsap helpers) and `FloatingGlyphs.svelte` imported nowhere; deleted | debt | Fixed |
| WP27 | `apps/web/motion-core.json`, `gsap` and `@types/gsap` in `apps/web/package.json` are now unused (needs a lockfile change) | debt | Fixed (lead): deps and `motion-core.json` removed |
| WP28 | `.landing-*` and `.glyphtex-mock*` rules in `packages/ui/src/app.css` have no users in apps; `Reveal`, `SectionHeader`, `Eyebrow`, `Chip` no longer used by apps | debt | Fixed (lead): landing and mock CSS removed; `Reveal`, `SectionHeader`, `Eyebrow` deleted. `Chip` stays (blog uses it) |
| WP29 | `PageHero` badge always renders the check tile; a warning badge ("prototype") reads as a tick. Needs a `badgeTail`/icon prop in `lib/site/PageHero.svelte` (read-only here), so download omits the badge | ux | Fixed (lead): `PageHero badgeIcon` / `TiltedChip icon` |
| WP30 | Author avatar and blog heroes are SVG, so `<img>` stays; `Figure.svelte` accepts any `src` and would render a raster through a bare `<img>`. `@unpic/svelte` is not an `apps/web` dependency | perf | Open |
| WP31 | Prerender and loads unchanged: every docs/blog/about load is `prerender = true` and synchronous (no waterfalls) | perf | Fixed (verified) |
| WP32 | `sitemap.xml` lists about, download, engine, privacy, docs, blog, tags, posts, docs pages; no change needed | seo | Fixed (verified) |

## 7. Web workspace audit

Scope: `apps/web/src/routes/workspace/**`, `lib/workspace`, engine/main-file/storage dialogs, landing import and live editor, review of `lib/{storage,git,tex}`, compile, service worker.

| id | finding | kind | status |
| --- | --- | --- | --- |
| WW01 | `tex/worker.ts` `evictOldVersions` deleted every `/engine/packs/*` entry and `packs-index.json` on each boot (pack keys carry the pack hash, not the engine version), so user-installed packs vanished every other session. Now keeps packs the current index lists. | bug | Fixed |
| WW02 | `tex/manifest.ts` awaited `cache.put` unguarded: a quota rejection after a good fetch fell into the offline path and could report "not available offline". `cache.match` calls in `manifest.ts`, `packs.ts`, `worker.ts` now best-effort too. | bug | Fixed |
| WW03 | Async waterfalls: `WorkspaceHome.refresh` (list then quota), project page load and working-tree reload (`getProject` then `readFiles`), `duplicateProject`. Now `Promise.all`. | perf | Fixed |
| WW04 | Project page `$effect` wrote `showMainFile` from `project` (AGENTS.md section 3), and re-popped the prompt after a dismiss on any project reassignment. Now `$derived` plus a per-document dismissal. | state | Fixed |
| WW05 | `MainFileDialog` re-seeded `selected` via `$effect`. Now a writable `$derived` keyed on `open`. | state | Fixed |
| WW06 | Star and rename waited on IndexedDB then re-read the whole list. Now optimistic with rollback and a toast on failure; delete stays confirmed and non-optimistic. | UX | Fixed |
| WW07 | `EngineNotices` `transition:fly` ignored reduced motion. Gated with `MediaQuery`. | a11y | Fixed |
| WW08 | Engine install dialog: progress had no `progressbar` role, no size, error red-only. Now determinate bar with `aria-valuenow`/`valuetext`, label, "x of y MB", "Download failed." word, 40px `primary` action, icon tile, roles. | a11y | Fixed |
| WW09 | Storage panel was a dialog for a side task. Now a right sheet from `md`, bottom sheet on phones; `bg-brand` bar to `bg-primary`; "Nearly full" carries an icon and word; protection state carries a shield glyph; 40px controls. | UX | Fixed |
| WW10 | Legacy tokens and banned styles: `border-brand`, `text-brand`, `bg-surface-soft`, `border-hairline`, `text-foreground/90`, `bg-muted-foreground/50`, `text-[13px]`, `backdrop-blur-sm` overlays, `h-7` Button overrides. Replaced with real tokens; blur removed. | tokens | Fixed |
| WW11 | Workspace error states (storage unavailable, missing document, open failed) used `text-lg`/`text-sm` and bare underline links, no single next action. Now `panel-card` on canvas, `text-heading-sm` h1, one 40px primary action (Try again / Back to documents), raw error behind Details. | UX | Fixed |
| WW12 | Project page wrapped the whole workbench in `role="application"`, which switches screen readers out of browse mode for menus and panels. Removed; added an sr-only h1 with the document name (the workbench renders none). | a11y | Fixed |
| WW13 | `ImportDropzone` (landing feedback): copy wrapped word by word in the narrow aside. Now a `@container` card: icon + title + one-line hint + three 40px outline buttons in a row from `@2xl` (the row needs ~672px to avoid squeezing the hint), stacked below. Dashed `border-border` 18px card on `bg-card dark:bg-background`; drag-over is `border-primary bg-primary/5` plus the title "Drop to open". Parallel dynamic imports. | UX | Fixed |
| WW14 | `LiveEditor` (landing feedback): removed the redundant "This is the editor itself" line; footer status is now true ("Edits stay in this tab" / "Edited, not saved") with one `default` action; file rows 32px, active `bg-muted` + medium weight, focus rings; `aria-current` only on the active row; placeholder uses `font-editor text-sm`. Lazy CodeMirror load kept. | UX | Fixed |
| WW15 | Em dashes in comments in `compile.ts` and `compile-cache.ts`; long comments in touched files compressed. | style | Fixed |
| WW16 | No skip link or `main#main` in the workspace: `ProjectsHome` renders no `<main>`, `Workbench` renders `<main>` without an id. Needs `id="main"` on both in `packages/ui` so a skip link can target them. | a11y | Fixed: `id="main"` on both mains (UA) and a skip link inside `Workbench` and `ProjectsHome` (lead), so both apps get it |
| WW17 | `ProjectsHome` (packages/ui, in progress by its owner): at review time the search field was `bg-muted` without a border, primary list actions were 32px `icon-sm`, and the content column used `max-w-[1100px]`. Re-verify against Orbit Home after that pass. | tokens | Fixed (UA): bordered search, 40px toolbar, `max-w-6xl` |
| WW18 | `ProjectsHome` clone input: 32px controls, `placeholder:text-muted-foreground`, `autofocus`. Should use `Input`/`InputGroup` at 40px. | tokens | Fixed (UA): 40px clone controls |
| WW19 | Engine install and main-file dialogs can open at the same time on a first visit to an ambiguous imported project. Should queue the main-file prompt until the install dialog closes. | UX | Open |
| WW20 | Project page `$effect` mirrors `ctrl.files.mainId` to storage via `setEntry`. It is persistence, not state duplication, but silently swallows failure. | state | Open |
| WW21 | `normalisePath` strips a leading `/` rather than rejecting absolute paths, and accepts drive-letter segments (`C:`). Harmless for IndexedDB keys; tighten if paths ever reach a real filesystem. | security | Open |
| WW22 | `git/provider.ts` `stage`/`discard` join UI-supplied paths to the repo dir without rejecting `..`. Paths come from `statusMatrix`, so low risk; validate at the boundary. | security | Open |
| WW23 | `git/mirror.ts` `toWorkingTree`/`fromWorkingTree` read and compare files sequentially; large repos pay one IndexedDB round trip per file on every status refresh. | perf | Open |
| WW24 | `LiveEditor.openInWorkspace` falls back to `/workspace` on a storage failure with only a console log; the user gets no message. | UX | Open |
| WW25 | `LiveEditor` hides the file list below `sm`, so phone users only ever see `main.tex`. | UX | Open |

## 8. Desktop audit (apps/desktop)

Scope: `apps/desktop/src/**` edited; `apps/desktop/src-tauri/**` reviewed only. `tauri dev` / `tauri build` not run (no webview here), so runtime behaviour is unverified beyond svelte-check.

| id | finding | kind | status |
| --- | --- | --- | --- |
| DK01 | Settings used top tabs with a JS-measured gliding indicator (3 `$effect`s + ResizeObserver) and `text-[13px]`, `bg-brand`, `text-brand` | design/perf | Fixed: left nav, 40px rows, active = `bg-muted` + `font-medium` + blue icon + `aria-current` |
| DK02 | Two headings per settings page (layout h1 "Settings" plus page h2) | a11y | Fixed: one h1 per page via `$lib/settings-header.svelte`, which also sets a per-page `<title>` |
| DK03 | Settings had no keyboard way back and no skip link | a11y/Jakob | Fixed: skip link to `#settings-main`; Esc returns to projects (capture phase, ignored while a dialog, listbox or menu is open or focus is in a field) |
| DK04 | Settings selects were 28px `size="sm"` and `xs` 24px buttons | Fitts | Fixed: 40px select triggers (`$lib/settings-select.svelte`) and default 40px buttons |
| DK05 | Folder menu integration on macOS/Linux: clicking Add showed "Added" because the Rust no-op returns Ok | bug | Fixed: disabled on non-Windows, and the description says why |
| DK06 | Cloud sync was a paragraph, not a setting | UX | Fixed: disabled switch with "Not available yet" and a Coming soon badge |
| DK07 | Shell escape risk read as an ordinary toggle | Von Restorff | Fixed: warning badge "On for every project" (glyph + words) while enabled |
| DK08 | Updater: a manual check in dev or outside Tauri reported "You're on the latest version" | honesty | Fixed: new `unavailable` status, "Updates are turned off in development builds", button disabled |
| DK09 | Updater: unknown content length showed 0% forever; bar had no label or progressbar role | honesty/a11y | Fixed: `$lib/update-progress.svelte` shows MB received of total and %, `role="progressbar"`, a full muted bar when the size is unknown |
| DK10 | Updater: Retry always re-ran the check, even after a failed download or install | bug | Fixed: `failedStep` + `retry()` repeats the failed step |
| DK11 | Updater: offline boot check popped an "Update failed" card on every launch | UX | Fixed: failed checks stay off the card; a manual failure shows inline in About with plain copy and raw details in `<details>` |
| DK12 | Updater card: raw `e.message` shown as the user copy | AGENTS §2.5 | Fixed: plain `FAILURE_COPY`; raw error only in About details and console |
| DK13 | Updater card `transition:fly` bypassed reduced motion; 24px buttons; `text-[12.5px]`, `bg-brand-subtle`, `text-muted-foreground/70` | motion/tokens | Fixed: duration 0 under `prefersReducedMotion`, 40px actions, `aria-live="polite"`, tokens only |
| DK14 | About showed a fake "v0.1.0" when the version couldn't be read | honesty | Fixed: badge hidden until `getVersion()` resolves |
| DK15 | About had no inline download/restart; it pointed at the corner card, which may be dismissed | UX | Fixed: Download, Restart to update, Try again and progress inline |
| DK16 | Error page: gradient logo, `text-[11px]`, 32px buttons, reload hidden under a ghost xs button | design | Fixed: Orbit ErrorState (tilted chip, h1 with blue second line, primary + outline 44px, details for non-404); Go back falls back to Projects with no history |
| DK17 | `NavProgress color="var(--brand)"` legacy alias | tokens | Fixed: `var(--primary)` |
| DK18 | `importZip` had no try/catch: a bad archive failed silently as an unhandled rejection | bug | Fixed: plain dialog + raw details |
| DK19 | Clone destination used the URL's last segment unchecked (`..` or `name:` could escape or break the chosen parent) | security | Fixed: `repoName` strips separators, `:` and Windows-invalid chars and rejects dot-only names |
| DK20 | Create and clone errors showed `String(e)` as the whole dialog | AGENTS §2.5 | Fixed: plain sentence first, raw cause after "Details:", logged |
| DK21 | Git remote name, URL or branch starting with `-` reaches system git as an option (`--upload-pack=...` runs a command); `ext::` transport | security | Fixed in `$lib/git.ts` (rejects both, defence in depth). Backend fix still Open as DK30 |
| DK22 | Engine `version` joined into a path by Rust with no validation (`../../x` escapes the engines dir) | security | Fixed in `$lib/engine.ts` (release-tag regex). Backend fix still Open as DK31 |
| DK23 | Long comments in +layout.svelte, layout.css, ProjectsPage, engine.ts | comments | Fixed (platform facts kept) |
| DK24 | No raw `invoke` outside typed clients; no `load` waterfalls (only `ssr=false` and a redirect) | review | OK |
| DK25 | `git.ts` invokes rely on contextual generic inference, not runtime validation of returned shapes | types | Open |
| DK26 | Deleting a disk-backed project removes any root, including user-opened or cloned folders. The dialog shows the path and warns, but AGENTS §4 says don't delete user-imported folders | product | Open: needs a decision (delete only app-data projects, "remove from list" for others) |
| DK27 | `$effect` redirect in `editor/[id]` when the project is missing; `initTauriTheme` in `$effect` with no deps | Svelte | Open, minor: acceptable navigation/DOM side effects |
| DK28 | Editor and home import `@glyphtex/ui/application` barrel; home and engine settings may pull Workbench (CodeMirror, pdf.js) if tree-shaking misses | perf | Open: needs subpath exports in packages/ui |
| DK29 | `csp: null`; fs capabilities `allow-read-file`/`allow-write-file` scoped `**` | security (src-tauri) | Open, High |
| DK30 | git.rs 719-839: remote name, URL and branch passed positionally with no `--`; `#authedUrl` falls back to the raw string | security (src-tauri) | Open, High |
| DK31 | project.rs 89-163: read/write/create/rename/delete/exists accept any absolute path; `delete_path` is `remove_dir_all` on anything | security (src-tauri) | Open, High: scope to an allowlist of opened roots |
| DK32 | git.rs 31: an imported `.git/config` or hooks run during pull/push (`core.fsmonitor`, `core.sshCommand`, hooks) | security (src-tauri) | Open, High: `-c core.hooksPath=... -c core.fsmonitor=false -c protocol.ext.allow=never` |
| DK33 | git.rs 403-415, 313, 594: `git_discard`/`git_stage`/`file_sides` join `rel` without a traversal check | security (src-tauri) | Open, High |
| DK34 | compile.rs 338-356: latexmk runs a project `.latexmkrc` (Perl) even with shell escape off | security (src-tauri) | Open, Medium: `-norc` unless trusted |
| DK35 | Shell escape is global, not per project | security | Open, Medium: per-project trust prompt (packages/ui settings store + workbench) |
| DK36 | git.rs 677: clone persists a token URL to `.git/config`; token URLs in git argv show in process lists; gix errors may echo credentials | secrets (src-tauri) | Open, Medium: auth via env/askpass, strip userinfo, scrub errors |
| DK37 | engine.rs 39/294/306: `version` unvalidated in Rust; engine.rs 272: downloaded binary has no checksum | security (src-tauri) | Open, Medium |
| DK38 | project.rs 318/336: `import_zip` has no size or entry caps (zip bomb); zip-slip is handled | security (src-tauri) | Open, Low |
| DK39 | compile.rs 552: `compile_project` accepts an absolute `main` outside `root` | security (src-tauri) | Open, Low |
| DK40 | git.rs 105-883 and engine.rs 92-304: async commands do blocking gix I/O, clone/fetch, process spawns and `remove_dir_all` inline, with no `spawn_blocking` | perf (src-tauri) | Open, High |
| DK41 | shell_integration.rs 13/84/115: sync `fn` commands spawn `reg` | perf (src-tauri) | Open, Medium: Windows-only, still breaks §4 |
| DK42 | compile.rs 511/545: `EngineEnv::resolve` does FS work before `spawn_blocking` | perf (src-tauri) | Open, Low |
| DK43 | gix spawns ssh/upload-pack for ssh:// and file:// without `no_window()` | platform (src-tauri) | Open, Low |
| DK44 | Updater pubkey present, https endpoint; `LaunchPath` mutex never held across await | review (src-tauri) | OK |
| DK45 | packages/ui `SettingsSection`: `shadow-craft-sm` at rest, `border-border/60` hairlines, `text-sm`/`text-xs` header | needs packages/ui | Open |
| DK46 | packages/ui `SettingsField` md: label should be `text-body font-medium`, description `text-body text-muted-foreground`; sm uses `text-[13px]`/`text-[11px]`; no `disabled` prop to dim a row | needs packages/ui | Open |
| DK47 | packages/ui `SelectTrigger` has no 40px size (desktop overrides with `data-[size=default]:h-10`) | needs packages/ui | Open |
| DK48 | packages/ui `Segmented`: `text-[10px]`/`text-[11px]`, arbitrary shadow, 28-32px only; blocks the Orbit SegmentedControl for Theme | needs packages/ui | Open |
| DK49 | packages/ui `EngineSettings` and `SliderControl` not reviewed against the 40px controls table | needs packages/ui | Open |

## 9. UI application audit (`packages/ui/src/components/application`)

Nothing here was viewed in a browser. Gates: biome format/lint clean on changed files, desktop check 0 errors, web svelte-check 11 baseline errors, `@glyphtex/ui` tests 191/191.

| id | finding | kind | status |
| --- | --- | --- | --- |
| UA-01 | Legacy aliases across ~45 files: `text-faint` (82), `bg-surface*`, `text-brand`/`bg-brand*`/`border-brand`/`ring-brand`/`outline-brand`/`accent-brand`, `var(--color-faint)`. Mapped to `text-muted-foreground`, `placeholder:text-placeholder`, `bg-muted`, `primary`, `bg-primary/10`, `border-ring`/`ring-ring` for focus | tokens | Fixed |
| UA-02 | Opacity on text tokens (`text-muted-foreground/50-80`, `text-foreground/80-90`, `text-brand/60`) in 16 files | contrast | Fixed |
| UA-03 | `text-[0.8125rem]`, `text-[0.6875rem]`, `text-[11px]`, `text-[10px]`, `text-[0.625rem]` in chrome | type | Fixed (text-sm / text-xs) |
| UA-04 | Raw `#000` in mask gradients (editor-pane, editor-tabs); `bg-white` on PDF thumbnails | tokens | Fixed (`var(--foreground)`, `bg-fixed-light`) |
| UA-05 | Fields on `bg-input` / `bg-muted`: notes, page field, rename, explorer filter, projects search | tokens | Fixed (`bg-background border-border`, focus border `--ring`) |
| UA-06 | SyncTeX seam button hovered to a blue fill (ink emphasis, not state) | tokens | Fixed (`hover:bg-muted`) |
| UA-07 | Editor tabs: raised card pill with shadow at rest on a muted rail; active icon not blue; main-file icon faded to 60% | active state | Fixed (rail `bg-background`, pill `bg-muted`, active icon `text-primary`, sr-only "(main file)", dirty state in close label) |
| UA-08 | Active items without blue icon or inset focus ring: view tabs, file tree rows, dock tabs, problem rows, projects rail | active state | Fixed |
| UA-09 | Git status letters (M/A/D/U/R/!) colour + letter only, no word for AT | state | Fixed (title + sr-only status) |
| UA-10 | Problems: error and warning shared one triangle glyph, told apart by hue; dock counts coloured numbers only | state | Fixed (circle-x for error, sr-only severity and counts) |
| UA-11 | Compile status error glyph matched warning triangle | state | Fixed (circle-x) |
| UA-12 | Git row stage/discard buttons invisible on keyboard focus | a11y | Fixed (`focus-visible:opacity-100`) |
| UA-13 | ProjectsHome grid card: ghost pages fanning out, hover lift, `shadow-craft-lg` on hover, shadows at rest | motion | Fixed (border-strong on hover, press scale only) |
| UA-14 | ProjectsHome Svelte `in:`/`out:`/`animate:` bypassed reduced motion | motion | Fixed (`motionMs` from new `motion.ts`) |
| UA-15 | `transition:slide` in git-panel, change-tree, history, remotes, settings, panel-section ungated | motion | Fixed (`reveal()` helper) |
| UA-16 | Custom easings `cubic-bezier(0.25,1,0.5,1)`, `(0.23,1,0.32,1)` | motion | Fixed (`ease-craft`) |
| UA-17 | ProjectsHome: grid cards hid starred; star glyph had no text; empty states for search/starred/recent had no next action; h1 off-spec weight | home | Fixed (star + sr-only, Clear search / All projects actions, `text-heading font-medium`) |
| UA-18 | ProjectsHome storage meter warning by colour only | state | Fixed (sr-only "Storage nearly full") |
| UA-19 | Skip link target: `<main>` in workbench and ProjectsHome had no id (coordinator request) | a11y | Fixed (`id="main" tabindex="-1" outline-none`; ProjectsHome's main is `Sidebar.Inset`) |
| UA-20 | ProjectsHome search had no border; toolbar and clone controls 32px; `max-w-[1100px]` (coordinator request) | home | Fixed (bordered field with ring focus, 40px row: search, icon buttons, Import, New project, clone input + confirm; `max-w-6xl`) |
| UA-21 | `slash-menu` `$effect` clamped `active` from `matches` (state sync) | runes | Fixed (`$derived` clamp over a `cursor` state) |
| UA-22 | PDF bytes in `$state` (compile store, asset viewer) | perf | Fixed (`$state.raw`) |
| UA-23 | `EditorShell` placeholder (mentions Monaco) exported but unused in both apps | dead code | Fixed (deleted with its barrel export) |
| UA-24 | Long comments in touched files (36 blocks) | comments | Fixed (compressed to 2 lines, facts kept) |
| UA-25 | Asset viewer image `shadow-craft-lg` at rest | elevation | Fixed (`shadow-sm`, inset visual) |
| UA-26 | Visual editor document type scale uses `text-[2rem]`..`text-[0.95rem]`, `leading-[1.6]`, `tracking-[...]`; inline runs use em-relative `text-[0.85em]` | type | Open: needs a document type-scale token set in app.css |
| UA-27 | `workbench-surface` dark sets `--muted` equal to `--card` (#232323), so `bg-muted` hover is invisible on cards; workbench chrome keeps `bg-accent` (#2f2f2f) for hover/active | tokens | Fixed (lead): workbench dark `--muted` is `#2a2a2a` (muted ink 5.56:1) |
| UA-28 | Project cards show file count and modified time but no size: `Project` has no size field and `files` is a stale snapshot for disk projects | home | Open: needs a host-provided size in `lib/state/projects.svelte.ts` |
| UA-29 | Sidebar active icon colour is set per call site; belongs in `sidebar-menu-button` | primitives | Open: primitives owner |
| UA-30 | Right panel, dock and side panel are inline columns; no right sheet / bottom drawer on narrow widths | overlays | Open |
| UA-31 | CodeMirror core and `lang-markdown` statically imported by `code-editor/controller.svelte.ts` | perf | Open: markdown language could load on demand |
| UA-32 | `side-panel.svelte` `$effect` records previous view to derive slide direction | runes | Open (previous-value pattern, low risk) |
| UA-33 | `AboutDialog` defaults `version = '0.1.0'` and no caller passes a version (desktop package 0.0.1, tauri 0.1.0) | honesty | Open |
| UA-34 | Print CSS comment "until Tectonic compiles for real" in workbench.svelte is stale deferred work | debt | Open |
| UA-35 | Bare `<img>` fallback for viewBox-only SVG in asset viewer (AGENTS asks for unpic) | debt | Open (unpic needs intrinsic size) |
| UA-36 | Long pre-existing comments in untouched files (controller, files, layout, types, search stores, code-editor, diff-view, export-menu, file-kinds, outline, project.ts, jetbrains-theme) | comments | Open |
| UA-37 | Comment gate false positives: `"image/*"` string in float-card (and glob strings in controller, jetbrains-theme) read as block comments | gate | Open: gate script |

## 10. UI primitives audit (`packages/ui/src/components/ui`, `lib/{utils,craft-utils,hooks,state/persisted-state}`)

Nothing here was viewed in a browser. Gates: biome format/lint clean on 87 changed files, comment/dash gate clean, desktop check 0 errors, web svelte-check 12 errors (the 11 baseline plus `apps/web/src/lib/site/TiltedChip.svelte`, an untracked file owned by another agent).

| id | finding | kind | status |
| --- | --- | --- | --- |
| UP-01 | No shared focus, scrim or overlay-surface tokens; each wrapper hand-rolled `ring-3 ring-ring/50`, `ring-primary/30`, `bg-black/10` | reuse | Fixed (`CRAFT_FOCUS_RING`, `CRAFT_FOCUS_RING_INSET`, `CRAFT_SCRIM`, `CRAFT_OVERLAY_SURFACE` in `craft-utils.ts`, re-exported from `utils`) |
| UP-02 | Scrims `bg-black/10` + `backdrop-blur-xs` (dialog, sheet, drawer); sheet scrim had no fade | tokens, motion | Fixed (`bg-fixed-dark/40`, backdrop fade on sheet) |
| UP-03 | Menus and select were glass (`bg-popover/70`, `backdrop-blur-2xl`, `ring-foreground/10`, `shadow-md`) with `**:` overrides that forced destructive items to non-red text | tokens, state | Fixed (`bg-popover` + hairline + `rounded-xl` + `shadow-lg` on dropdown, sub-content, menubar, select, popover, hover-card, dialog; overrides removed) |
| UP-04 | Dropdown `size` context set inside `$effect` (setContext after init) and only read by `Item` | bug | Fixed (set at init with a getter; checkbox, radio and sub-trigger now read it too) |
| UP-05 | Menu rows 27px, highlight `bg-foreground/10`, icons not muted, checks not blue; `text-[11px]`/`text-[14px]`/`text-[13px]` sizes; `secondary` variant used `text-secondary` (a fill colour) | tokens, state | Fixed (shared `DROPDOWN_MENU_ROW`: `min-h-8`, `bg-accent` highlight, muted icons, `text-primary` checks; used by dropdown, menubar, select items; command items `min-h-8` + blue check) |
| UP-06 | Dropdown sub-content portal comment 5 lines; sub-content lacked `z-50` once portalled | comments, bug | Fixed |
| UP-07 | Dialog/sheet close 32px on mobile; dialog `rounded-2xl` with `ring-1` | a11y | Fixed (`size-10 sm:size-8`, surface token) |
| UP-08 | Drawer handle duplicated classes; no `shadow-lg` | tokens | Fixed |
| UP-09 | Tooltip was inverse (`bg-foreground text-background`); `Kbd` inside it used `text-background` | tokens | Fixed (popover surface + hairline arrow; kbd on `bg-muted` + hairline, `font-mono`). Tooltip keeps `rounded-lg`, not `xl`: a 28px chip at 14px radius reads as a pill |
| UP-10 | Inputs/textarea/select/input-group: `ring-3 ring-ring/50`, invalid halo `ring-destructive/20`, `dark:aria-invalid:border-destructive/50` faded the invalid border; textarea placeholder `text-muted-foreground`; select trigger transparent | focus, tokens | Fixed (border `--ring` + 2px offset ring, invalid border `--destructive` in both themes, `placeholder:text-placeholder`, select `bg-background`, open border `--ring`) |
| UP-11 | Checkbox/radio `ring-3 ring-ring/50`, radio dot was an `IconCircle` with a fill, indeterminate checkbox unfilled | focus, state | Fixed (`CRAFT_FOCUS_RING`, plain dot, indeterminate filled blue) |
| UP-12 | Tabs: `transition-all`, `text-foreground/60`, commented-out class line, junk classes (`gap-2-list-variant-default`), dead `default_soft` branch while the variant is `soft`, `tv()` without `twMergeConfig`, Tween ignores reduced motion | tokens, debt, motion | Fixed |
| UP-13 | `tv()` without `{ twMergeConfig }`: button-group, input-group-addon, input-group-button, sidebar-menu-button, eyebrow, tabs-list, dropdown context | debt | Fixed |
| UP-14 | Svelte `transition:slide` and `Spring`/`Tween` bypass the CSS reduced-motion guard: collapsible, panel-section, slider-control, tabs-list, nav-progress | motion | Fixed (`prefersReducedMotion` from `svelte/motion`) |
| UP-15 | Nav progress glow (`0 0 8px color99`), invalid CSS with a `var()` colour | tokens | Fixed (glow removed, `shadow` prop accepted and ignored) |
| UP-16 | Sonner: `text-[13px]`, `text-faint`, `shadow-craft-lg`, 20px close, variant carried by icon colour alone, 14-line comment | tokens, a11y | Fixed (roles, `rounded-xl shadow-lg`, 24px close, sr-only "Success:"/"Error:"/... word, explicit 5s duration; `aria-live="polite"` and no focus steal are svelte-sonner defaults) |
| UP-17 | Chip: undefined `border-border-low`, `bg-foreground/3`, "×" glyph, selected state by colour only, rendered a `<button>` inside callers' `<a>` | tokens, a11y | Fixed (tokens, `IconX`, check glyph when selected, static `<span>` without `onclick`, new optional `href`) |
| UP-18 | Eyebrow `text-[11px]`, `text-foreground/80`, glass `bg-card/60` + blur, inset shadow var | tokens | Fixed |
| UP-19 | Segmented `text-[10px]`/`text-[11px]`, `ring-border/40`, custom ease, `ring-primary/30` focus | tokens, focus | Fixed (`text-xs`, tokens, 300ms `ease-craft` thumb, inset ring) |
| UP-20 | Slider/ColorField rows: `border-border/40 bg-card/60`, `text-[12px]`, `text-foreground/85`, `focus-within` ring (fires on mouse) | tokens, focus | Fixed (`has-[:focus-visible]` ring) |
| UP-21 | ColorPicker: `#cbd5e1` checker, `border-white ring-black/40` marker, `text-[10px]`/`[11px]`, swatch `hover:scale-110`, eyedropper without focus ring, 7-line comment | tokens | Fixed (SV gradient `#000/#fff` kept: colour math, not a surface) |
| UP-22 | Settings section `shadow-craft-sm` at rest, `/60` hairlines; settings field `text-[13px]`/`text-[11px]` | tokens | Fixed |
| UP-23 | Panel section `text-faint`, `text-muted-foreground/70`, `ring-primary/30`, 5-line mode comment | tokens | Fixed |
| UP-24 | Sidebar: `hsl(var(--sidebar-border))` on hex tokens (no outline rendered), `text-sidebar-foreground/70`, `transition-all` rail, `ease-linear`, floating/inset shadows at rest, focus rings clipped in scroll areas, junk `cn-sidebar-trigger` | tokens, focus | Fixed |
| UP-25 | Logo `#ffffff`/`#0a0a0c` tones and a legacy VS Code blue gradient (`#1F9CF0`) | tokens | Fixed (`--fixed-light`/`--fixed-dark`, gradient from `--primary`) |
| UP-26 | Menubar checkbox `text-brand`; shortcut `text-muted-foreground/60`, `text-[11px]`; trigger `text-[13px]` | tokens | Fixed |
| UP-27 | Hover card passed `preventScroll`, which `LinkPreview.Content` does not accept (type error) | bug | Fixed |
| UP-28 | Long comments (36 gate hits) across chip, collapsible, logo, nav-progress, reveal, sonner, tabs, theme, sidebar context, persisted-state, slider, segmented | comments | Fixed |
| UP-29 | Dead code: `SegmentedToggle`, `persisted()` factory, exported `inferSerializer`; `PersistedState.#area` duplicated `area()` | debt | Fixed (deleted / unexported / reused) |
| UP-30 | Dead subpaths with a `package.json` export and no importer in either app or package: `menubar`, `drawer`, `hover-card`, `radio-group`, `tabs`, `card` (parts), `collapsible`, `color-field`, `color-picker` (only used by color-field), `theme` | debt | Open (deleting needs `packages/ui/package.json`, out of scope) |
| UP-31 | Root barrels `src/index.ts` and `components/ui/index.ts` have no importer and omit chip, logo, menubar, switch, settings-*, theme-toggle | debt | Open (same `package.json` "." export) |
| UP-32 | Drawer wrappers are typed for vaul-svelte 1.x; installed 0.3.2 has no `ref`, `Root`/`Portal` namespaces differ (8 errors in a package-level svelte-check, none in either app) | bug | Open (dependency bump) |
| UP-33 | Overlap: `Eyebrow` (uppercase pill) vs `SectionHeader`'s eyebrow (plain `.landing-eyebrow`); web uses only `Eyebrow variant="muted"`. `Chip` and `Badge` share the pill shape but Chip is interactive | duplication | Fixed (lead): `Eyebrow` and `SectionHeader` deleted (no importers); Chip/Badge overlap still Open |
| UP-34 | `PanelSection` collapsible header renders the `action` snippet inside its `<button>` (nested interactive) | a11y | Open (needs a header layout change and call-site check) |
| UP-35 | `Segmented` is `role="radiogroup"` but every segment is a tab stop and arrows do nothing | a11y | Open (roving tabindex is a behaviour change) |
| UP-36 | `SliderControl` value is editable only after an 800ms pointer hover; keyboard users can't reach the text field | a11y | Open |
| UP-37 | `Dialog`/`Sheet` default `preventScroll={false}`, so the page scrolls behind a modal | behaviour | Open (intentional per wrapper defaults; confirm with lead) |
| UP-38 | No drawer menus exist, so the 44px mobile row spec has no consumer; dropdown `size="sm"` stays a 28px dense opt-in (no call sites) | spec | Open |
| UP-39 | Edge sheets are square-cornered; the `rounded-xl` overlay rule is applied to floating overlays only | spec | Open (confirm) |
| UP-40 | Logo `<linearGradient id="glyphGradient">` repeats per instance, so ids collide when several gradient logos render | bug | Open (all instances share one gradient today) |
| UP-41 | `Card` parts (`CardHeader`/`CardContent` `px-4`) double the `Card` `p-6` padding; footer `rounded-b-xl` inside a `rounded-2xl` card | tokens | Open (no consumers yet) |

