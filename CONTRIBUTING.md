# Contributing to GlyphTeX

Thanks for taking the time to help out! This guide covers how to get GlyphTeX
running on your machine and how to send a change our way. Bug reports, feature
ideas, docs fixes, and pull requests are all welcome.

## Ways to contribute

- **Found a bug or have an idea?** Open an [issue](https://github.com/kanakkholwal/glyphtex/issues) — a clear description and steps to reproduce go a long way.
- **Want to write code?** Comment on the issue you'd like to take (or open one first for anything non-trivial), then send a pull request. Small, focused PRs are easiest to review.
- **Docs and copy** count too — typos, unclear wording, and missing setup steps are all fair game.

## Project layout

```
apps/
  web/        Browser editor and site (SvelteKit on Cloudflare Workers)
  desktop/    Tauri desktop app (src-tauri/ is the Rust side)
  server/     Optional Teams server (Hono, Postgres); see apps/server/AGENTS.md
packages/
  ui/         Shared components, design tokens, the Workbench
  email/      Email templates (edit, then `pnpm --filter @glyphtex/email build`)
  tex-engine/ In-browser Tectonic engine wrapper
crates/       Rust sources for the WASM engine
```

The same editor runs on the web and in the desktop shell. Read [AGENTS.md](AGENTS.md) for the engineering rules (single source of truth, design tokens only, Svelte 5 runes).

## Prerequisites

You'll need:

- **[Node.js](https://nodejs.org/) 22 or newer**
- **[pnpm](https://pnpm.io/installation) 10+** — the package manager this repo uses (`npm install -g pnpm`)

Only needed if you're working on the **desktop app** (the Tauri/Rust side):

- **[Rust](https://www.rust-lang.org/tools/install)** (stable toolchain, via `rustup`)
- **Tauri's system dependencies** for your OS — follow the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/) (on Windows that's the Microsoft C++ Build Tools and WebView2; macOS needs Xcode Command Line Tools; Linux needs a few `webkit2gtk` packages).

You can work on the **web app and shared UI without Rust** — skip the Tauri bits.

## Getting set up

```bash
git clone https://github.com/kanakkholwal/glyphtex.git
cd glyphtex
pnpm install        # installs everything across the monorepo
```

## Running it

```bash
# The browser editor + site  → http://localhost:5173
pnpm dev:web

# Teams server (optional, needs Postgres; see apps/server/README.md)
pnpm --filter @glyphtex/server dev

# The desktop app in a native window (needs the Rust prerequisites)
pnpm dev:desktop

# Everything at once
pnpm dev
```

## Before you open a pull request

Please run these and make sure they pass:

```bash
pnpm check          # type-checking across the project
pnpm --filter @glyphtex/server test   # if you touched the server
pnpm lint           # biome: lint + format check
pnpm lint:fix       # biome: auto-fix and format your changes
```

If you touched the Rust side of the desktop app, also run:

```bash
pnpm lint:rust                              # clippy
pnpm --filter @glyphtex/desktop test:rust     # Rust unit tests
```

## Pull request guidelines

- **Branch** off `main` and keep each PR focused on one thing.
- **Describe the change** — what it does and why. Screenshots help for anything visual.
- **Keep the style consistent** — match the code and design conventions already in the file you're editing; the formatters and linters above will catch most of it.
- **Link the issue** your PR addresses, if there is one.

## License

Contributions are licensed under the license of the part you change: GPL-3.0-or-later by default ([LICENSE](LICENSE)), AGPL-3.0-or-later for `apps/server`, MIT for `packages/tex-engine` and `crates/`.
