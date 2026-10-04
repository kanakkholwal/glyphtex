# GlyphTeX redesign brief

A complete, executable plan to move GlyphTeX (marketing site + editor chrome) onto one design built on
baby-ui's Svelte port, the same way kanakkholwal.eu.org was rebuilt in Oct 2026. Written for an agent with no
memory of that work. Every claim cites a path; re-verify counts before quoting them back.

## 0. How to use this brief

- Load the global skill **`site-redesign`** first. It holds the method, the lessons and the scripts
  (`~/.claude/skills/site-redesign/`). This brief is the GlyphTeX-specific layer on top of it.
- Companion skills per phase: `auditing-design-systems` + `ui-ux-pro-max` (audit, colour), `emil-design-eng` +
  `apple-design` (motion and craft), `modern-web-guidance` (before any CSS), `svelte-core-bestpractices`,
  `svelte-runes`, `svelte-styling`, `sveltekit-structure` (all Svelte work), `workers-best-practices` (deploy),
  `deslop` (copy and diffs).
- Notes, audits and the design contract go in `.notes/` (already gitignored). Do not create tracked plan files.
- Never commit or push; the owner commits. Stop at every **Checkpoint** and ask.
- Writing rules: no em or en dashes anywhere, no buzzwords, comments max 2 lines.

## 1. Product and audience

- "The LaTeX editor Overleaf should have been." Local-first: Tectonic compiled to WASM runs in the tab, no
  account, papers never leave the machine (`README.md`).
- Audience: researchers, PhD students, anyone writing a thesis, proof or paper (`README.md`).
- Live: https://glyphtex.nexonauts.com (`apps/web/src/lib/seo/site.ts`). Part of the Nexonauts family
  (Orbit, Recast, Docvia, Baby UI, Specimen), so the result should feel related to them.
- Two surfaces with different jobs:
  - **Marketing** (`/`, `/about`, `/engine`, `/download`, `/templates`, `/privacy`, `/errors`): earn trust
    fast, show the editor, get someone into `/workspace` in one click.
  - **Product** (`/workspace`, `(scopes)/recent|starred|templates`, `/workspace/projects/[id]`): a tool used
    for hours. Calm, dense, keyboard-first, nothing animates that is used 100 times a day.
- Docs and blog run on Docvia (`apps/web/docvia.config.ts`, `content/blog`, `content/docs`).

## 2. Current state (facts)

| Area | Today | Evidence |
| --- | --- | --- |
| Repo | pnpm + turbo monorepo | `pnpm-workspace.yaml`, `turbo.json` |
| Apps | `apps/web` (SvelteKit: marketing + product), `apps/desktop` (Tauri 2, "unmaintained prototype") | `README.md` |
| Shared UI | `packages/ui` (`@glyphtex/ui`): primitives, workbench, CodeMirror 6 editor, live tokens | `packages/ui/src/app.css` |
| Unused design pkg | `packages/design` (Framer-inspired oklch tokens), imported nowhere | grep `@glyphtex/design` → 0 |
| Framework | SvelteKit ^2.63, Svelte ^5.56 (runes), Vite 8, Tailwind 4.3 | `apps/*/package.json` |
| Components | shadcn-svelte style "nova", bits-ui, vaul-svelte, svelte-sonner, tailwind-variants | `packages/ui/components.json` |
| Icons | `@tabler/icons-svelte` only, 115 files | grep |
| Motion | Svelte transitions (22 uses), `svelte/motion` (6 files), `application/motion.ts`, `tw-animate-css` | grep |
| Fonts | Inter, Google Sans (headings), Source Code Pro (UI mono), Geist Mono + JetBrains Mono (editor); `geist` and `quicksand` deps never imported | `packages/ui/src/app.css` l.1-6 |
| Tokens | 711-line `app.css`, mostly hex (171 hex values), primary `#025eb8`, `.dark` class | `packages/ui/src/app.css` |
| Theme variants | 7 `data-brand` presets with dark overrides; nothing sets `data-brand` | grep → 0 setters |
| Design docs | Root `DESIGN.md` describes **Framer's** marketing system, not GlyphTeX; the real system is `.notes/DESIGN.md` | `DESIGN.md` l.1 |
| SEO | `Seo.svelte` (12 routes), `jsonld.ts`, sitemap, robots, RSS, `llms.txt` | `apps/web/src/lib/seo/` |
| OG | `static/og/default.svg` + per-post `/og/blog/[slug]` served as `image/svg+xml` | `+server.ts` l.62 |
| Analytics | GA4 via a provider registry with opt-out | `apps/web/src/lib/analytics/` |
| Deploy/CI | Cloudflare Workers; `deploy-web.yml`: lint, engine sync, check, build | `.github/workflows/` |
| Checks | `pnpm check`, `pnpm lint` (Biome 2.5), `node --test`; `packages/ui` has `"check": "exit 0"` | `packages/ui/package.json` l.280 |

## 3. Design debt (ranked by leverage)

1. **Two token systems and two design docs that disagree.** `packages/design` is dead; root `DESIGN.md` is
   another company's system. Any agent reading the repo gets the wrong brief.
2. **OG images are SVG.** X, LinkedIn, Facebook, Slack and iMessage don't render SVG `og:image`; every share
   shows a blank card. Highest-impact single fix on the marketing side.
3. **The shared UI package is never typechecked** (`"check": "exit 0"`), so the workbench can drift silently.
4. **Hex-based tokens** (171 values) with 7 unused brand presets: the accent model is undecided.
5. **Durations are ad hoc:** `duration-200` ×42, `-150` ×22, `-300` ×11, `-500` ×2, `-100` ×2; only 5 use the
   `--duration-dropdown` token. JS durations 260 ×4, 240, 360, 100. Three cubic-beziers, one tokenised.
6. **Two marketing block sets:** `packages/ui/src/components/blocks/public/*` and
   `apps/web/src/lib/landing` + `lib/site` + `SiteHeader`/`SiteFooter.svelte`.
7. **Five fonts plus two unused deps.** One display/body family and one mono would do.
8. Arbitrary values: `rounded-[...]` ×11, `shadow-[...]` ×3, `z-[...]` ×1. Boot splash in `apps/web/src/app.html`
   duplicates colours inline.

## 4. Direction

Target: one design on baby-ui tokens and motion, shared by marketing and product through `packages/ui`.

- **Keep**: local-first and privacy as the core message, the editor as the hero, Docvia docs/blog, the existing
  SEO plumbing, GA with opt-out, keyboard-first workbench.
- **Drop**: `packages/design`, Framer `DESIGN.md`, the second marketing block set, unused fonts and deps, unused
  brand presets (or wire them, see Phase 3), `tw-animate-css`.
- **Feel**: academic and precise. Paper, ink and a single accent. The marketing page shows the real editor
  compiling a real document in the hero, not illustrations.

**Checkpoint (Direction):** offer three directions with mockups via AskUserQuestion before building, e.g.:
- A. *Editor-forward*: dark-optional, the workbench screenshot/live demo is the hero, minimal copy around it.
- B. *Paper*: light editorial page, a typeset PDF page as the hero object, serif display for headings.
- C. *Hybrid*: B's editorial marketing, A's calm dense product chrome, one shared token set.
Also ask: typeface family (stay Inter/Google Sans, or Geist + Geist Mono like the rest of the Nexonauts family),
and whether accent presets should be user-selectable in the editor settings.

## 5. Phased plan

### Phase 0: setup
1. `git switch -c feat/redesign` from a clean tree.
2. Baseline screenshots: `pnpm dev:web`, then
   `THEMES=light,dark WIDTHS=375,1280 node ~/.claude/skills/site-redesign/scripts/shot.mjs http://localhost:<port> .notes/before home about engine download templates docs blog workspace`.
3. Create `.notes/redesign-audit.md` with the decisions log.

### Phase 1: audit
Follow `references/01-audit.md` of the skill. Measure contrast of the current primary and every text pair
(`auditing-design-systems`). List every route's focal point and primary action. Separate marketing findings from
workbench findings. Note which workbench interactions are high frequency (tab switch, pane toggle, command
palette, mode switch): those get no animation.

### Phase 2: foundation
1. **Docs first.** Delete `packages/design` (and its workspace entry). Replace root `DESIGN.md` with the real
   system (start from `.notes/DESIGN.md`, then update it as decisions land). Point `AGENTS.md` at it.
2. **baby-ui Svelte.** In `packages/ui`, install from the public registry:
   `npx shadcn-svelte@latest add https://baby-ui.pages.dev/svelte/r/tokens.json` then `theme`, then primitives
   one at a time (`button`, `tooltip`, `dialog`, `command`, `tabs`, `select`, `dropdown-menu`, `popover`,
   `toast`...). Check each exists first (`curl -o /dev/null -w "%{http_code}"` on the URL). Diff against the
   current primitive; keep local API differences only where the workbench depends on them.
3. Copy baby-ui `theme.css`'s full `@theme inline` block into `packages/ui/src/app.css` (the CLI merges only
   extensions; missing popover/card mappings render transparent).
4. **Fonts**: per the checkpoint answer. Remove `@fontsource-variable/geist`/`quicksand` if unused, and the
   faces you drop. Editor mono stays separate (it's a product setting).
5. **Icons**: keep Tabler (115 files, one family) unless the direction says otherwise; the rule is one family.
6. **Typecheck the shared package**: give `packages/ui` a real `check`
   (`svelte-package` sync if needed + `svelte-check`), and make `turbo run check` include it.
7. Write `.notes/design-contract.md` from the skill's `design-contract-template.md` with GlyphTeX paths.

### Phase 3: colour and tokens
- Convert tokens to oklch from baby-ui's ramps. Neutrals never move; brand on `--primary` with a separate ink
  for text and rings (`--accent-ink`).
- Decide the 7 `data-brand` presets: either wire them to an editor setting (boot script in `app.html` sets
  `data-brand` before paint, crossfade on change) or delete them. Unused code is not an option.
- Boot splash in `apps/web/src/app.html`: read the same CSS vars instead of duplicating hex.
- Measure every preset, light and dark: fill vs label ≥ 4.5:1, ink vs background ≥ 4.5:1, rings ≥ 3:1.
- Editor syntax theme (`packages/ui/src/lib/editor/jetbrains-theme.ts`, 58 hex) is content, not chrome: leave it,
  but check it against the new background in both themes.

### Phase 4: motion
- Replace every `duration-NNN` and raw cubic-bezier with `duration-(--duration-*)` / `ease-(--ease-out)`.
  Fold `--ease-craft`, `--duration-dropdown/panel-exit/overlay` into baby-ui's tokens or alias them.
- Svelte `transition:` uses: keep only where they animate an exit that CSS can't (conditional blocks); use
  token durations. `svelte/motion` springs only for pointer-driven things (pane resize).
- Page transitions on the marketing routes via `onNavigate` + `document.startViewTransition` in the root layout
  (pattern in the skill's `04-motion.md`). Do not transition between workspace routes.
- No open/close animation on the command palette or anything bound to a shortcut.
- `prefers-reduced-motion`: opacity only. Keep the existing `prefers-contrast` and reduced-transparency blocks.

### Phase 5: shell and pages
- **Marketing**: pick one block set (likely `apps/web/src/lib/landing` + `lib/site`), delete the other, rebuild
  on the contract. Hero shows the editor compiling. One primary action: "Open the editor" → `/workspace`.
  Secondary: download (desktop is a prototype; label it honestly).
- **Product**: restyle `workbench.svelte` and `workbench/*` (title bar, toolbar, tabs, panes, dock, mode switch)
  on tokens only. Density over decoration. Focus rings visible. Panel toggles instant.
- States: loading (compile in progress) as a slim progress line, not a spinner; compile errors in the dock with
  file:line links; empty states for no projects/no templates; 404 and error pages in the site layout.
- Docs/blog: style Docvia output with the same prose tokens.
- Fan pages out to subagents with the design contract, then review every page yourself (light/dark, 375/1280).

### Phase 6: content
- Rewrite marketing copy in the owner's plain voice: specific claims ("compiles in your browser, offline") over
  adjectives. Verify every claim against the engine's real capabilities (`packages/tex-engine/KNOWN_ISSUES.md`).
- Desktop app: say it's a prototype.

### Phase 7: OG and SEO
1. **Render OG cards as PNG** (satori/takumi or resvg on the server, prerendered where possible): default card,
   per blog post, per docs page, per template. Versioned URLs (`?v=N`). Keep SVG as the source if convenient,
   but serve PNG with `og:image:width/height`.
2. Keep `Seo.svelte` and `jsonld.ts`; add `BreadcrumbList` on docs/blog, `TechArticle`/`BlogPosting` with
   `dateModified`, and make the `SoftwareApplication` entry carry `offers: price 0`, `applicationCategory`.
3. Run `node ~/.claude/skills/site-redesign/scripts/seo-crawl.mjs http://localhost:<port>` and fix every issue
   (titles ≤ 70, descriptions 50 to 165, one h1, canonical, og:image on every route).
4. `/workspace*` routes: `noindex`.

### Phase 8: data and performance
- WASM engine load is the critical path: measure time to first compile on a throttled profile before and after;
  never let redesign assets compete with the engine download (preload order, no heavy hero media).
- GA stays production-only and respects the opt-out.

### Phase 9: verify and ship
```bash
pnpm lint
pnpm check          # now includes packages/ui
pnpm --filter @glyphtex/web test && pnpm --filter @glyphtex/ui test
pnpm build:web
node ~/.claude/skills/site-redesign/scripts/check-comments.mjs --all
```
Screenshot matrix vs `.notes/before`, `states.mjs` for loading/error/404, keyboard-only pass through the
workbench, reduced motion, dark-mode toggle on a page with shared transition names. Confirm `apps/desktop`
still builds since it shares `packages/ui`. Update `.notes/redesign-audit.md` and report.

## 6. Risks and constraints

- `packages/ui` is shared by web and desktop; a primitive API change breaks both.
- CodeMirror theming and editor fonts are user-facing settings; don't regress saved preferences (migrate keys if
  token names change).
- The engine (`packages/tex-engine`, `crates/`) is out of scope.
- Docvia output styling depends on its class contract; check a long docs page and a code-heavy page.

## 7. Done means

- [ ] One token system, one `DESIGN.md` that describes GlyphTeX, `packages/design` gone
- [ ] baby-ui primitives installed via CLI; contract written in `.notes/`
- [ ] All durations/easings tokenised; reduced motion verified
- [ ] Marketing rebuilt on one block set; workbench restyled; states designed
- [ ] OG cards are PNG and versioned; crawl clean; workspace noindexed
- [ ] `pnpm lint`, `pnpm check` (incl. `packages/ui`), tests, build, comment gate: output pasted
- [ ] Screenshot matrix reviewed; desktop still builds
