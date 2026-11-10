<div align="center">

# GlyphTeX

### A free, local-first LaTeX editor for theses, papers and presentations.

Write real LaTeX in your browser. It compiles on your own device, no account needed.

**[Open the editor](https://glyphtex.nexonauts.com/workspace)** · **[Docs](https://glyphtex.nexonauts.com/docs)** · Open source

</div>

---

## Why it exists

Overleaf made LaTeX easy to start. The catch is that your project lives on its servers: compiles queue and time out on the free plan, and history, Git and collaborators sit behind a paywall.

GlyphTeX runs the compiler in your browser tab. No build queue, no timeouts, no upload.

## What you get

- **Real LaTeX.** Standard `.tex` and `.bib`, math, figures, BibTeX/biblatex, thesis and journal templates.
- **Compiles on your device.** [Tectonic](https://tectonic-typesetting.github.io/) compiled to WebAssembly. The compiler downloads once (about 12 MB), then works offline.
- **Live preview.** Source beside the PDF, click to jump between them, clickable error list with line numbers.
- **Private by default.** Projects are stored in your browser. Nothing is uploaded unless you choose to share.
- **Coming from Overleaf?** Download the project as a `.zip` and drop it into the workspace.

## Optional: accounts and sharing

Self-hosters can run the [Teams server](apps/server) (Postgres, Docker or Cloudflare Workers) to add sign-in, cloud projects, invite links, organizations and roles. Everyone still compiles on their own device. The public web app works without it.

## Desktop app

A Tauri desktop build (system TeX or bundled Tectonic, built-in Git client) lives in [apps/desktop](apps/desktop). It is behind the web editor and the Releases page builds are outdated, so use the web app unless you want to hack on it.

## Repository

```
apps/web        Browser editor and site (SvelteKit, Cloudflare Workers)
apps/desktop    Tauri desktop app
apps/server     Optional Teams server (Hono, Postgres)
packages/ui     Shared UI and design system
packages/email  Email templates for the server
packages/tex-engine, crates/   In-browser Tectonic engine (WASM)
```

## Run it locally

Needs Node 22+ and pnpm 10+.

```bash
pnpm install
pnpm dev:web      # http://localhost:5173
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the desktop and server setup.

## License

- App, UI and email templates: [GPL-3.0-or-later](LICENSE)
- Teams server (`apps/server`): [AGPL-3.0-or-later](apps/server/LICENSE)
- TeX engine (`packages/tex-engine`, `crates/`): MIT
