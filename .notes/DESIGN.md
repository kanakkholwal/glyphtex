# GlyphTeX Design System

A blueprint surface for a local-first LaTeX editor. White cards sit on a light gray canvas between
dashed column rails. Structure comes from 1px hairlines, generous spacing and one blue accent.

> **Borders, not depth.** A container is a 1px hairline and a radius. If a surface needs a shadow
> to read, it needs better spacing instead.

The system follows [Orbit](../../orbit/DESIGN.md), which mirrors the Rune Icons reference (layout,
neutrals, dark palette, radii, type scale, card grammar). What is GlyphTeX's own:

| Exempt | Value | Why |
| --- | --- | --- |
| Brand accent | blue, `#025eb8` / `#59aaf8` | GlyphTeX's identity (hue 250). Tuned in Sept 2026; the old `oklch(0.52 0.17 250)` clipped sRGB. |
| Workbench dark surfaces | `#191919` / `#232323` / `#373737` | The code editor's JetBrains Islands theme is built on them. Scoped by `workbench-surface`. |
| Workbench density | `text-xs/sm/md` = 12/13/14, 24/32px controls | An IDE toolbar, not a marketing page. Public pages use roles only. |
| Editor font | JetBrains Mono (and Geist Mono option) | AGENTS.md. UI mono is Source Code Pro. |

Tokens live in [packages/ui/src/app.css](../packages/ui/src/app.css), the one live token file for
both apps. `packages/design` is unused. Never hardcode a hex in a component.

---

## Colour

### Surfaces and ink

| Role | Light | Dark | Token |
| --- | --- | --- | --- |
| Page canvas (public pages) | `#f5f5f5` | `#0a0a0a` | `--canvas` → `bg-canvas` |
| App background | `#ffffff` | `#0a0a0a` | `--background` |
| App card (projects home) | `#ffffff` | `#161616`, cards inside `#1d1d1d` | `--workspace` → `workspace-card` (re-points `--background` and `--card`) |
| Card | `#ffffff` | `#171717` | `--card` |
| Muted fill, hover fill | `#f5f5f5` | `#262626` | `--muted` |
| Stronger fill (tile on muted) | `#efefef` | `#2a2a2a` | `--surface-strong` |
| Hairline | `#e5e5e5` | `rgb(255 255 255 / .10)` | `--border` |
| Strong border (hover) | `#d4d4d4` | `rgb(255 255 255 / .16)` | `--border-strong` |
| Input border | `#e5e5e5` | `rgb(255 255 255 / .15)` | `--input` (a border, no longer a fill) |
| Ink | `#0a0a0a` | `#fafafa` | `--foreground` |
| Muted ink | `#6b6b6b` | `#a1a1a1` | `--muted-foreground` |
| Placeholder, control boundary | `#707070` | `#8a8a8a` | `--placeholder` |
| Near-black action | `#0a0a0a` | `#fafafa` | `--action` |

Muted ink measures 5.33:1 on white, 4.89:1 on the canvas, 4.63:1 on `--surface-strong`. Dark muted
ink measures 7.66:1 on `#0a0a0a`, 6.94:1 on `#171717`, 5.86:1 on `#262626`, 5.18:1 on the workbench
`#2f2f2f`.

**Ink hierarchy is binary: `foreground` or `muted-foreground`.** The old third step (`--faint`,
`--ink-muted` `#9e9e9e` at 2.68:1) cannot clear 4.5:1 on the canvas, so it was removed. The legacy names (`--ink*`, `--surface*`, `--hairline*`, `--brand*`, `--faint`) are gone; use the roles.

**Cards on public pages** use `panel-card` (or `Card tone="panel"`): white in light, `--background`
in dark, so a dark card is told apart from the canvas by its hairline alone.

### The accent

| Token | Light | Dark |
| --- | --- | --- |
| `--primary` | `#025eb8` `oklch(0.49 0.16 255)` | `#59aaf8` `oklch(0.72 0.14 250)` |
| `--primary-active` | `#0256a9` | `#4ba3f7` |
| `--primary-foreground` | `#ffffff` (6.37:1) | `#0a0a0a` (8.04:1) |
| `--ring` | `--primary` | `--primary` |

Light: **6.37:1** on white, **5.84:1** on the canvas, **5.48:1** on a `bg-primary/10` tint.
Dark: **8.04:1** on `#0a0a0a`, 7.28:1 on `#171717`, 7.14:1 on `#191919`, 5.44:1 on `#2f2f2f`.

`--primary` is for: accent words in a headline, the page's one brand action, links in body copy,
active and selected states, focus rings, toggle-on and progress fills. Never a large flat background.

**`--primary` used to be near-black.** Since this pass, anything that meant "ink action" uses
`--action` (`bg-action`, `Button variant="default"`).

### Brand presets

`data-brand` on `<html>` swaps the accent as a light/dark pair: emerald, teal, violet, indigo, orange,
rose, slate. Every pair measures at least 4.5:1 on white, the canvas, `#0a0a0a`, `#171717` and
`#191919`. Default (blue) sets no attribute. No UI sets a preset yet.

### Brand panel

`panel-brand` is pure CSS from `--brand-panel`: `feTurbulence` grain, blueprint hairlines at 22% white,
two streaks (24% toward white) and a deep radial shade (28% toward black). No raster. It stays the
light brand in dark mode. White on `#025eb8` measures 6.37:1; text on a panel is a 30px+ headline or
centred body copy away from the streaks.

### Semantic colour

| Token | Light | Dark |
| --- | --- | --- |
| `--destructive` | `#c0242a` (5.95:1 white label) | `#ff6b61` |
| `--success` | `#0a7d47` | `#30d158` |
| `--warning` | `#8a5c00` | `#ff9f0a` |
| `--info` | `#00627a` | `#5ac8dc` |

`--info` is cyan, not Orbit's `#0060c9`: that blue sits 0.027 OKLab dE from the accent under every
vision type. The cyan clears 0.10 except tritan (0.055). Success and destructive collide under
deuteranopia (0.058). **State is never colour alone**: every status carries a glyph or a word.

### Contrast floors

| Thing | Floor |
| --- | --- |
| Body text on its surface | 4.5:1 |
| Focus ring, control boundary, meaningful icon | 3:1 |
| Two controls distinguished by colour | 3:1 luminance **or** >0.10 OKLab dE under CVD |

Checkbox, radio and switch-off boundaries use `--placeholder` (4.95:1 on white, 4.54:1 on a muted field, 5.19:1 on dark `#171717`). Orbit's `#737373` measured 4.35:1 on a muted field. The
hairline (1.25:1) is decorative only. **Never fade a text token with an opacity modifier**
(`text-muted-foreground/60` measures 2.68:1). Tints on fills and `text-fixed-light/85` on a brand
panel are fine.

---

## Typography

Self-hosted through Fontsource, imported at the top of `app.css`.

| Token | Face | Package | Applies to |
| --- | --- | --- | --- |
| `--font-heading` / `font-display` | Google Sans Variable | `@fontsource-variable/google-sans` | `h1`-`h6` (base layer), wordmark |
| `--font-sans` | Inter Variable | `@fontsource-variable/inter` | `body` and everything that inherits |
| `--font-mono` | Source Code Pro Variable | `@fontsource-variable/source-code-pro` | Code in UI, paths, keycaps |
| `--font-editor` | JetBrains Mono Variable | `@fontsource-variable/jetbrains-mono` | The code editor only |

h1/h2 are weight 500 with `-0.02em`; h3-h6 are 600 with `-0.01em`.

### Roles

| Token | Size / line | Role |
| --- | --- | --- |
| `text-caption` | 12 / 16 | Chips, meta, tags, footer legal |
| `text-body` | 14 / 20 | Body copy, card copy, buttons, FAQ answers |
| `text-body-lg` | 16 / 24 | Card titles, FAQ questions, ledes from `md` |
| `text-body-xl` | 18 / 28 | Rare emphasis |
| `text-subheading` | 20 / 28 | Legal section h2 |
| `text-heading-sm` | 24 / 32 | Prose h2, stat numbers |
| `text-heading` | 30 / 36 | Prose h2 from `sm` |
| `text-heading-lg` | 36 / 40 | Page h1 (mobile), split-section h2 |
| `text-display` | 48 / 1 | Page h1 from `md`, brand panel h2 |
| `text-display-xl` | 60 / 1 | Landing hero h1 and closing CTA from `lg` only |

`text-7xl` and above clamp to 60px. **No `text-[Npx]`.** Workbench chrome may use `text-xs`/`text-sm`/
`text-md` (12/13/14); public pages use roles.

| Element | Classes |
| --- | --- |
| Landing hero h1 | `text-heading-sm sm:text-heading-lg md:text-display lg:text-display-xl font-medium` |
| Page h1 (`PageHero`) | `text-heading-lg md:text-display font-medium`, accent on a second line |
| Section h2 (`SplitSection`) | `text-heading-lg font-medium`, accent on a second line |
| Card h3 | `text-body-lg font-medium` |
| Lede | `text-body md:text-body-lg text-muted-foreground` |
| Meta | `text-caption` |

`cn()` and `tv()` both use `twMergeConfig` from [utils.ts](../packages/ui/src/lib/utils.ts), which
registers every `text-*` role and `text-md`. Without it,
tailwind-merge reads `text-body` as a colour and drops it next to `text-foreground`. Pass
`{ twMergeConfig }` as the second argument of every new `tv()`.

---

## Shape and elevation

| Utility | Value | Use |
| --- | --- | --- |
| `rounded-sm` | 6px | Chip inner tiles, keycaps |
| `rounded-md` | 8px | Buttons, tilted chips, nav controls |
| `rounded-lg` | 10px | Icon tiles, list rows |
| `rounded-xl` | 14px | Inset visuals, navbar shell, search inputs |
| `rounded-2xl` | 18px | Cards, FAQ cards |
| `rounded-3xl` | 22px | Bento cards from `md`, brand panels, footer card, search card |
| `rounded-full` | 9999px | Pills, status tags, round submit |

Nest radii inward. **Cards carry no shadow at rest**; inputs never. `shadow-xs` on filled buttons,
`shadow-sm` on inset visuals and the scrolled navbar, `shadow-lg` on floating overlays. No hover
lifts, no glows, no blurred colour blobs. There are no `shadow-craft-*` or `rounded-pill` tokens.

---

## Layout (public pages)

Public pages render inside `RailFrame` ([apps/web/src/lib/site](../apps/web/src/lib/site)), which owns
the skip link, `SiteHeader`, `<main id="main">`, `SiteFooter` and the rails.

- **Column** (`rail-column`): `min(95vw, 1440px)`, `min(90vw, 1440px)` from `md`, `min(85vw, 1800px)` from 1536px.
- **Rails:** two fixed 2px dashed lines in `--border`.
- **Rows:** `RailRow` = full-bleed 2px dashed rule, then the column with `p-3 sm:p-6`. The first row
  passes `divider={false}` and carries the floating navbar's height (`pt-28 sm:pt-32`). `label` names
  the section; `section` reports it to analytics once.

| Primitive | Shape |
| --- | --- |
| `TiltedChip` | `-rotate-2` hairline chip, 12px semibold, check tile (or `tail` snippet). Max two per view. |
| `PageHero` | Tilted chip, h1 with blue second line, lede, actions, optional `aside` |
| `SplitSection` | Title + accent + description (+ `aside`) left, content right; `sticky` pins the title |
| `BrandPanel` | `panel-brand` 22px card, centred white h2, body, `ink` + `light` actions |
| `FaqList variant="cards"` | bits-ui accordion, numbered 18px cards, blue index, one open, measured height |
| `ErrorState` | Tilted "Error 404" chip, h1 + accent, primary + outline, details for non-404, popular pages |
| `CountUp` | Real number in SSR; counts up once hydrated unless reduced motion |

### Landing (`apps/web/src/routes/+page.svelte`)

1. **Hero:** tilted chip, h1 "Write LaTeX / on your machine", lede, `primary` + `default` actions,
   live stats (GitHub stars streamed from the server with a 1.5s timeout and hidden on failure,
   LaTeX commands documented floored to 50 with "+", packages completed, guide count),
   `LocalCompile` illustration.
2. **Try the editor:** title and lede side by side, then the real `LiveEditor` full width (CodeMirror
   loads on scroll) with the Overleaf `.zip` drop zone full width beneath it. Never in a narrow aside.
3. **Bento:** six plain-language benefits, token visuals plus `RevisionStack`.
4. **FAQ** cards beside a sticky split title with "Talk to us about a campus" and "Fix a LaTeX error".
5. **Closing CTA** on `BrandPanel size="hero"`.

### Fix a LaTeX error (`/errors`, prerendered)

A help tool, not a pitch, so it has its own page (linked from the footer's Learn column and the landing
FAQ). `GuideLauncher` owns the h1: Orbit Explore search over the real docs and blog, topic chips
(active: blue icon tile), 56px field, round submit, Enter opens the best match, live count in
`aria-live`. Opens on the error guides' category when one exists. Ends in a `BrandPanel` with
"Ask on GitHub" (ink) and "Browse all docs" (light).

### Navbar and footer

`SiteHeader` follows the Rune Icons navbar: a full-width bar on `bg-canvas` with a 2px dashed bottom rule, content in `rail-column`. Logo left. Docs, Errors and Blog sit centred in one segmented track (`bg-muted` p-1, 32px items); the current page is the raised `bg-card` thumb with `shadow-xs`, medium weight and `aria-current`, so it reads without colour. Right: outline GitHub button with the live star count (compact, hidden when GitHub is unavailable, streamed from the root layout), outline X button, bordered theme toggle, and near-black "Open the workspace" from `xl`. Below `md` the links, workspace and theme move into the focus-trapped menu.

`SiteFooter` is a 22px card: logo, description, 40px social buttons, four link columns with caption
h2s, a legal line, then the oversized `GLYPHTEX` wordmark at 5% ink with a blue spotlight that
follows a mouse pointer.

C:\Users\kanak### Projects home (`ProjectsHome`, web `/workspace` and the desktop home)

Orbit's workspace home. The sidebar sits on `bg-canvas` (36px rows; active: base fill, medium weight, blue icon; project counts); the main area is a white card inset 8px from `md` with a 14px radius and a hairline. A 56px context bar holds the sidebar toggle, the scope and the theme toggle.

- **All projects** opens with an h1, then a start row: a dashed "New LaTeX project" card (48px blue icon tile, the page's one `primary` action, outline import actions, a ghost Clone that expands an inline 40px URL field) beside "Jump back in", the four most recently edited projects as 56px rows.
- **Library:** count, 40px search (`/` focuses it), sort menu labelled with the current order, grid/list segmented control. Grid cards are 18px bordered cards with a page thumbnail in a 14px muted inset (it carries the view-transition name that morphs into the editor), title, files or "On disk" with the edit time, a star glyph with a word for screen readers, and a 32px actions menu that stays visible on touch. The whole card opens the project.
- **Recent, Starred, Templates** use the scope as the only heading, skip the start row, and show search, sort and view only when there is something to act on; otherwise one honest empty state with one next action.
- **Storage (web):** a card in the sidebar footer with a labelled `progressbar` and a written warning past 80%. "Storage" opens a full-height right sheet on desktop and a bottom sheet (max 90dvh) on phones; refusals show as a bordered callout with a warning glyph.

### Boot splash

Inline in both `app.html` files, painting before CSS: `--canvas` ground, the G mark revealed by
clip-path, a 96 × 2px track with a blue segment. Content fades in after 150ms, auto-dismisses after 8s
if the app never mounts. Web shows it only on `/workspace` (server-rendered pages paint straight
away); the root layouts set `data-done` (desktop: `boot-leaving`) on mount.

---

## Illustrations

Isometric line art from [iso.ts](../apps/web/src/lib/illustrations/iso.ts): 30° projection, `box`,
`pyramid`, `plane`, `leftFace`/`rightFace`, `tether`, `groundPath`, self-sizing `viewBox`. Faces are
canvas-toned, strokes `--foreground` 1.25px `non-scaling-stroke`, one accent per scene, the ground
fades into the canvas through `FadeMask`.

| Scene | Use |
| --- | --- |
| `LocalCompile` | Hero: laptop with .tex source, local engine block (blue top), PDF pages, Git commits on the desk, crossed-out cloud; tethers flow 1.4s, sheets float 5s |
| `RevisionStack` | Bento "Every revision, kept": three document slabs, newest checked |

Each SVG has `role="img"` and an `aria-label`. Motion lives in `iso.css` inside
`prefers-reduced-motion: no-preference`. Mask ids are unique per scene.

---

## Components

### Buttons ([button.svelte](../packages/ui/src/components/ui/button/button.svelte))

| Variant | Treatment |
| --- | --- |
| `default` | Near-black `--action`, flips to near-white in dark |
| `primary` | Blue fill. One per view |
| `outline` | Card fill, hairline |
| `ghost` | Transparent, muted fill on hover |
| `ink` / `light` | Fixed near-black / white in both themes. Actions on a brand panel |
| `destructive`, `success`, `warning`, `info` (+ `_soft`) | Semantic tokens |
| `brand`, `brand_soft`, `default_soft`, `secondary`, `dark` | Aliases kept so older call sites compile |

Sizes: `default`/`icon` 40px, `lg` 44px, `xl` 48px; `sm`/`icon-sm` 32px and `xs`/`icon-xs` 24px are
workbench density only. Press: `active:scale-[0.98]`. Focus: 2px `--ring`, 2px offset.

### Badges, cards, inputs

- `Badge`: pill, `text-caption`; semantic variants are 10% tints with the token as text.
- `Card`: hairline, no shadow; `tone="panel"` for public pages.
- `Input`, `Textarea`, `Select`, `InputGroup`: `bg-background`, `border-border`, focus turns the
  border and ring `--ring`, invalid turns them `--destructive`, placeholder `--placeholder`.
- `Checkbox`, `Radio`: `border-placeholder` boundary, blue when checked. `Switch`: `bg-placeholder`
  off, blue on, fixed-white thumb.

### Overlays

Right sheet on desktop, bottom drawer on mobile (`vaul-svelte`). Nested dropdown submenus portal.

---

## Motion

One curve: `--ease-craft` = `cubic-bezier(0.32, 0.72, 0, 1)` (`ease-craft`). Press 100ms, hover
150-200ms, overlay 200/150ms, panel 300ms. The global reduced-motion block clamps CSS animation and
transition; JS motion (`CountUp`) checks `matchMedia` itself. `prefers-contrast: more` raises
hairlines to `#a3a3a3` / `#737373`; `prefers-reduced-transparency` drops backdrop blur.

---

## Dos and don'ts

**Do**

- Build public pages from `RailFrame` → `RailRow` → `PageHero` / `SplitSection` / `panel-card`.
- Use the role table for every text size on public pages.
- Put the blue on the key words of a title, on a second line.
- Show a number only if it is true and sourced live or from the repo.
- Test light and dark, a brand preset, and 125% OS scaling.

**Don't**

- Don't fade text tokens with an opacity modifier.
- Don't write `text-[13px]`, raw hex or palette colours (`blue-600`, `bg-white`) in components.
- Don't use `bg-primary` to mean near-black. That is `bg-action`.
- Don't add gradient text, glows, hover lifts or shadows at rest.
- Don't add a size, shadow or radius token without registering it in `twMergeConfig`.
