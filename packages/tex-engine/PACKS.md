# Package packs

How GlyphX ships LaTeX packages beyond the core bundle, and how to add more.

## The problem

The core bundle is *discovered*: compile the fixtures, feed `missingFiles` back
in, repeat. That makes it correct and self-verifying, but it also makes it
exactly as wide as the fixtures and no wider. Measured against 41 everyday
packages, **40 are absent** — `fancyhdr`, `titlesec`, `setspace`, `natbib`,
`csquotes`, `float`, `wrapfig`, `etoolbox`, `tcolorbox`…

Shipping all of TeX Live is not an option (it is gigabytes). Fetching
per-file on demand is the obvious alternative and was rejected: it puts the
network back in the compile path, which is the property the whole in-browser
engine exists to avoid, and it turns one clean failure into a partial one.

## The shape: packs

A **pack** is an independently downloadable, cached tarball of related packages.

```
core bundle   (required, ~8.6 MB gz)   engine + format + the 9 manifest groups
  + pack       "writing"               fancyhdr, titlesec, setspace, parskip…
  + pack       "figures"               float, wrapfig, subfig, rotating…
  + pack       "boxes"                 tcolorbox, environ…
```

Packs are the same artifact shape as the core bundle — a deterministic
`.tar.gz`, verified against a manifest, cached under a content hash — so they
reuse the machinery that already works rather than introducing a second one.

**Why packs and not per-file fetch**

| | packs | per-file on demand |
|---|---|---|
| Compile path | never touches network | network per missing file |
| Offline after install | complete | partial, silently |
| Failure mode | "install pack X" | "missing `foo.sty`", repeatedly |
| Bandwidth | user-controlled, once | opaque, ongoing |
| Verifiable | yes, at build time | no |

The cost is granularity: a pack pulls in packages the user may not use. At
these sizes (`.sty` files are kilobytes; fonts are what is heavy) that is the
right trade.

## Discovery: the missing-file → pack index

A pack is useless if users have to guess which one they need. Every pack build
emits the list of filenames it **provides**, and those are inverted into one
index:

```json
{ "fancyhdr.sty": "writing", "tcolorbox.sty": "boxes" }
```

When a compile fails with `missingFiles: ["fancyhdr.sty"]`, the editor looks the
name up and offers the pack by label and size, instead of surfacing a raw TeX
error. That turns the coverage cliff from a dead end into a one-click install.

Files that no pack provides are reported honestly as unsupported rather than
being silently retried.

## Type safety

The pack index is generated at build time and validated at load time
(`AGENTS.md` rule 4 — parse, don't guess). `PackIndex`, `PackDefinition` and
`InstalledPack` live in `src/packs.ts` as the single contract; the build script
writes JSON that conforms to it, and the runtime narrows before trusting it.
Adding a pack is a data change plus a rebuild — no new code paths.

## Adding a pack

1. Add an entry to `packs.config.json`: `id`, `label`, `description`, and the
   TeX Live `packages` it covers.
2. Add a fixture using it to `test/fixtures/packs/<id>.tex`. This is not
   optional — it is what proves the pack actually compiles, and it is the same
   discipline that caught `siunitx` shipping listed-but-broken.
3. Run `pnpm bundle:packs`. Each pack converges by the same `missingFiles` loop
   as the core bundle, **minus whatever core already provides**, so packs never
   duplicate core or each other.
4. Commit the built `.tar.gz` and the regenerated index.

## Invariants

- **A pack never contains a file the core bundle has.** Deduplicated at build
  time; the builder fails if a pack would shadow a core file, because two copies
  of a `.sty` diverging is a debugging nightmare.
- **A pack is self-sufficient given core.** Its dependency closure is resolved
  the same way the core bundle's is.
- **Packs come from the same TeX Live snapshot as the format.** A pack built
  against a newer kernel than `latex.fmt` reproduces the "LaTeX kernel too old"
  class of failure, which does not look like a version problem.
- **Every pack has a compiling fixture.** Presence in a manifest is not evidence
  that a package works.
