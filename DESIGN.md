## Identity

GlyphX is a local-first, privacy-first **LaTeX** editor for researchers,
students, engineers, mathematicians, and technical writers.

The visual language is **warm editorial minimal**: a warm stone-paper canvas, a
soft serif display voice for headline moments, a precise technical-mono register
for labels and metrics, and a single rationed **GlyphX blue** accent derived
from the brand mark.

The system pairs three voices:

* **Fraunces** (editorial serif) — large display headlines on the marketing
  surface. Warm, magazine-like, with *italic* emphasis on the words that carry
  the idea. Reserved for headline moments; never app chrome.
* **Geist** (sans) — the workhorse. Body copy, sub-heads, every interface label
  that isn't a code-register token. The app chrome is Geist, top to bottom.
* **Geist Mono** — the technical register. Uppercase, lightly tracked: nav
  items, section eyebrows (`#01 — COMPILE`), file names, metrics, engine badges,
  diagnostics, status indicators.

Directionally, GlyphX sits between the disciplined product end (Linear, Vercel,
Raycast, VS Code) and the warm editorial end of modern SaaS (autosend, Resend,
Stripe's prose pages) — calm, premium, and confident rather than loud.

The product should feel:

* Technical
* Precise
* Warm
* Quiet
* Trustworthy

The editor is the product. The chrome should disappear. The marketing surface
is where personality lives.

---

## Principles

### 1. Document first

The document is always the focal point. Whitespace is preferable to decoration.
Every UI decision should make writing easier, not louder.

### 2. Warm neutrals first, brand second

Design every screen in warm monochrome first. Introduce blue only where meaning
exists.

Target roughly:

* 90% warm neutral surfaces
* 10% brand color

The blue should feel intentional, not decorative.

### 3. Brand color is reserved

GlyphX blue communicates:

* Active
* Selected
* Focused
* Linked
* Branded

Avoid flooding screens with blue. On the marketing surface, blue is the
**primary CTA** and the eyebrow accent — nothing else competes with it. The
logo should be the most saturated object in the product.

### 4. Type creates hierarchy

Hierarchy comes from:

* Voice (serif display vs. sans body vs. mono label)
* Size
* Weight
* Spacing

Not color. Typography carries most of the visual structure. The editorial serif
does the emotional work; the mono labels do the structural work.

### 5. Depth is flat, structure is drawn

This system is intentionally flat. Depth comes from **contrast, spacing, and a
crisp warm grid-line** (`--hairline`, a solid stone line) — not from drop
shadows. Cards and controls separate from the canvas with borders, tonal fills,
and placement.

Two exceptions earn elevation:

* **Framed product mounts** — a browser/device frame on a photographic or dark
  backdrop, with a soft layered shadow and a faint brand glow. This is the
  modern "image" treatment; it is the one place imagery is allowed to lift.
* **Floating UI** — menus, popovers, the command palette.

Everything else stays on the grid.

### 6. Motion settles, never performs

One shared easing:

```css
cubic-bezier(.625,.05,0,1)
```

Elements fade, rise, blur, and settle. Never bounce. Never feel playful. GlyphX
is a precision tool.

---

## Typography scale

| Token             | Voice       | Use                                            |
| ----------------- | ----------- | ---------------------------------------------- |
| `headline-display`| Fraunces    | Hero H1. ~clamp(2.6rem, 6vw, 4.5rem), light.   |
| `headline-lg`     | Fraunces    | Major section H2. ~2.4–3rem, light.            |
| `headline-md`     | Geist       | Card / sub-section heads. ~1.5–1.75rem, 600.   |
| `headline-sm`     | Geist       | Small heads. ~1.25rem, 600.                    |
| `body-lg`         | Geist       | Lead paragraphs. 1.0625–1.125rem.              |
| `body-md`         | Geist       | Default body. 0.875–1rem.                      |
| `label`           | Geist Mono  | Eyebrows / nav / chips. UPPERCASE, `0.16em`.   |

The editorial serif (`.font-serif`) is **light weight** (400) with the SOFT
optical axis dialled up for warmth. Emphasis words use real *italics* — that
contrast (upright roman + slanted italic on one line) is the autosend signature.
Keep mono tracking subtle: crisp utility, not a coded aesthetic.

---

## Colour tokens

Semantic tokens drive the component library and editor chrome. Neutrals are
**warm stone**; blue is the single brand accent.

| Token                | Light                   | Dark                       | Role                  |
| -------------------- | ----------------------- | -------------------------- | --------------------- |
| `--background`       | `#FAFAF9`               | `#0C0B0A`                  | Warm paper floor      |
| `--canvas`           | `#FAFAF9`               | `#0C0B0A`                  | Root surface          |
| `--card`             | `#FFFFFF`               | `#1A1816`                  | Raised surface        |
| `--surface`          | `#F7F6F4`               | `#232020`                  | Elevated surface      |
| `--foreground`       | `#292524`               | `#ECE9E6`                  | Primary text (ink)    |
| `--muted-foreground` | `#79716B`               | `#A8A29B`                  | Secondary text        |
| `--primary`          | `#1C1917`               | `#F5F3F0`                  | Ink emphasis          |
| `--accent`           | `#E7E5E4`               | `#292523`                  | Stone hover surface   |
| `--border` (chrome)  | `rgb(41 37 36 / .10)`   | `rgb(245 240 235 / .09)`   | Warm translucent line |
| `--hairline` (mktg)  | `#E7E5E4`               | `rgb(245 240 235 / .10)`   | Solid structural line |
| `--brand`            | `#007ACC`               | `#1F9CF0`                  | GlyphX blue           |
| `--brand-hover`      | `#1177BB`               | `#38B6FF`                  | Interactive hover     |
| `--brand-subtle`     | `rgb(0 122 204 / .08)`  | `rgb(31 156 240 / .12)`    | Soft brand wash       |
| `--success`          | `#10B981`               | `#34D399`                  | Success state         |
| `--warning`          | `#F59E0B`               | `#FBBF24`                  | Warning state         |
| `--destructive`      | `#EF4444`               | `#F87171`                  | Error state           |

Two border tokens, two jobs:

* `--border` — the app's warm **translucent** hairline; adapts to the surface
  beneath it. Used in the desktop editor chrome.
* `--hairline` — the marketing layer's **solid warm stone line** (`#E7E5E4`).
  Draws the crisp structural grid (stat rows, feature cells, footer columns)
  that defines the editorial look.

---

## Brand colour

### Blue 400 — `#1F9CF0`
Gradient highlight / dark-mode brand.

### Blue 500 — `#007ACC`
Primary brand colour. The marketing CTA and the eyebrow accent.

### Blue 600 — `#1177BB`
Gradient depth and hover state.

### Stone ink — `#1C1917` / `#292524`
Warm primary text and the inverse (dark CTA) surface.

The brand gradient (`linear-gradient(135deg, #1F9CF0, #007ACC 55%, #1177BB)`) is
for the **logo, app icon, marketing hero glow, and framed-mount backdrops** only.
Never use gradients in general application UI.

---

## Buttons

Compact, confident, mono-labelled where they read as utility.

* **Primary** — `--brand` fill, white text, `rounded-lg` (12px), `h-9`–`h-12`.
  The single most saturated interactive object on a page. Reserve for the main
  conversion action.
* **Secondary** — white surface, solid warm border, ink text. Lower-emphasis
  actions ("Book a demo", "Try it in the browser").
* **Ghost / tertiary** — text-only, no container; behaves like a link.

Hover deepens fill or lifts to the stone `--accent`; never bounces.

---

## Imagery — the modern "mount"

The one place GlyphX is allowed to look rich:

* **Framed product mounts** — real product screenshots inside a browser/device
  frame (the three-dot chrome), `rounded-2xl`, sitting on a photographic or dark
  backdrop. A soft layered shadow + a faint `--brand-subtle` glow lifts them off
  the canvas.
* **Illustration motif** — a single recurring editorial illustration (in the
  autosend reference, a pixel-art landscape) can anchor the hero and feature
  backdrops. Used sparingly, it gives the brand a memorable, human texture.
* **Coded mockups** — supporting visuals (compile bar, git status, split
  preview) stay hand-coded so they track the real UI, but are framed and warmed
  to match the real mounts.

Imagery is mounted and framed — never a raw bleeding screenshot, never a
gradient blob.

---

## Dark mode philosophy

Dark mode is **warm graphite**, not navy and not cool. Paper-and-ink in light
mode; warm-graphite-and-ink in dark mode. Blue appears only in active states,
links, selections, focus indicators, and brand surfaces. The application itself
stays neutral.

---

## Do's and Don'ts

* **Do** keep pages spacious and centered with generous vertical rhythm.
* **Do** use Fraunces only for headline moments; keep UI copy in Geist / Geist Mono.
* **Do** reserve blue for the primary action and the eyebrow accent.
* **Do** rely on the warm grid-line and whitespace for depth, not shadows.
* **Do** frame imagery in mounts with a soft shadow + faint brand glow.
* **Don't** introduce heavy gradients, dramatic shadows, or glossy effects in UI.
* **Don't** use bright colours beyond the blue accent and the semantic states.
* **Don't** crowd the layout with dense sidebars or scattered hairlines —
  borders should read as one structural grid, not noise.
