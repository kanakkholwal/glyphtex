# GlyphTeX design system

One design for the marketing site and the editor, built on [baby-ui](https://baby-ui.pages.dev) (Svelte port).
Paper, ink and one blue accent. Structure comes from dashed hairlines and spacing, not boxes and shadows.

## Sources of truth

| What | Where |
| --- | --- |
| baby-ui tokens and theme (CLI-managed, do not hand edit) | `packages/ui/src/styles/registry.css` |
| GlyphTeX layer: accent, fonts, density, utilities | `packages/ui/src/app.css` (imports `registry.css` first) |
| Primitives (baby-ui, installed by the shadcn-svelte CLI) | `packages/ui/src/components/ui/*` |
| Public page primitives | `apps/web/src/lib/site/*` |
| Page rules for contributors and agents | `.notes/design-contract.md` |
| Decisions log | `.notes/redesign-audit.md` |

### Installing a baby-ui component

From `packages/ui`: `npx shadcn-svelte@latest add https://baby-ui.pages.dev/svelte/r/<name>.json --yes`.
The CLI writes `$lib/...` and `$components/...` imports; inside this package they must be relative (a consumer's
`$lib` is its own `src/lib`), so rewrite them after each install. `--overwrite` also resets `src/lib/cn.ts`;
restore its one-line re-export of `cn` from `./utils`. Add the package export in `packages/ui/package.json`.

## Colour

- Neutrals are baby-ui's (white page, `oklch(17%)` dark). Surfaces: `background`, `card`, `muted`, `popover`;
  ink: `foreground`, `muted-foreground`; hairline: `border`.
- The accent is GlyphTeX blue in baby-ui's `--accent` slot (`--primary` aliases it): `#025eb8` light (6.37:1 on
  white), `#59aaf8` dark (8.04:1 on `#0a0a0a`). Use it for the one primary action per page, links in body copy,
  focus rings, selected states and section numbers (`text-accent-ink`). Never a large flat background.
- Status colours (`success`, `warning`, `destructive`, `info`) only for real status; text uses the `-strong`
  form and always pairs with a glyph or a word.
- No hex in components, no palette colours, no gradients, glows or dot grids, no opacity on text tokens.

## Type

| Role | Face | Use |
| --- | --- | --- |
| Body, UI, h3 and below | Geist | `font-sans` |
| Display | Geist Pixel | `pixel` utility: page h1, section h2 on public pages. `--elsh` morphs on hover |
| Mono | JetBrains Mono | `font-mono`: meta, dates, counts, keys, paths; also the editor |

- Public pages: `text-xs` meta, `text-sm` lists, `text-base` prose, `text-lg` emphasis, `text-2xl` section
  titles, `text-4xl`/`5xl` page titles, `6xl` home hero only. No `text-[Npx]`.
- Section titles are lowercase with a full stop (`why local.`); a two-part title sets its tail in muted ink.
- The workspace keeps 12/13/14 density: `/workspace` sets `data-density="compact"` and `app.css` swaps
  `text-sm` to 13px through `:root:has(...)`, which also reaches portalled menus.

## Layout (public pages)

- `RailFrame`: a 76rem column with dashed side borders, hatched rails from `xl`, a sticky dashed top bar
  (links, ⌘K search, GitHub, theme, "Open the editor") and the footer. Pages never render these themselves.
- First row: `RailRow divider={false}` + `PageHero` (mono eyebrow, pixel h1, lede, actions, optional aside).
- Then `Section` (number, pixel title, description, action, dashed rule) or `SplitSection` (sticky title column).
- Lists are rows separated by `border-dashed`; link lists dim their siblings on hover. Grouped content sits in
  `Well` or `panel-card`. One closing `BrandPanel` (a plain well) per page at most.
- The site ⌘K menu is `SiteCommand`, opened from anywhere with `openSiteCommand()`.

## Workspace

- The editor is **Islands**: `workbench-surface` sets the canvas (`bg-canvas`) one step from the panels.
  The side panel, editor (tabs, code and PDF share one island), bottom dock and right panel are `rounded-xl`
  islands with 6px gaps; the gaps are the resize handles. The title bar sits on the canvas, no border.
- The projects home keeps its sidebar layout; its main card is an island like the editor's.
- Density stays 12/13/14 through `data-density="compact"`. Panel toggles and shortcut-bound UI never animate open.

## Motion

- CSS only, tokens only: `duration-(--duration-instant|fast|base|slow)`, `ease-(--ease-out)`, press scales
  `active:scale-(--press-scale*)`.
- `rise` (with `--i`) is the only entrance, on first paint, CSS only: content never waits on JavaScript.
- Nothing bound to a shortcut animates open (command palette, panel toggles). No hover lifts.
- Reduced motion: baby-ui tokens zero travel; an interim global clamp in `app.css` covers legacy durations.

## Social cards

`apps/web/scripts/og.mjs` renders a 1200×630 PNG per public route into `static/og/` (gitignored) before
`vite build`, with takumi-js in Node, so the Worker ships no renderer. `Seo` points every indexable page at
`/og/<path>.png?v=OG_VERSION`; bump `OG_VERSION` in `src/lib/seo/og.ts` when the template changes.

## Don'ts

- Don't edit `registry.css` by hand or add tokens anywhere but `app.css`.
- Don't use `bg-accent` as a hover fill (it is the brand blue); use `bg-foreground/[0.03|0.06]` or `bg-muted`.
- Don't gate server-rendered content behind JS (no opacity-0-until-hydrated reveals).
- Don't add a second icon set: `@tabler/icons-svelte` only.
