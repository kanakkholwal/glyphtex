# Browser smoke check

`pnpm --filter @glyphtex/ui test:browser`

Drives a real Chrome over the DevTools Protocol and checks that the Monaco
editor mounts, paints in the Islands theme, tokenizes LaTeX, and opens the
suggestion widget with our completions in it.

It installs nothing — it uses the Chrome already on the machine and Node's
built-in `WebSocket`.

## Why this exists

The unit tests (`test/*.test.mjs`) exercise the completion, semantic-token and
BibTeX logic directly, and they all passed while the editor was, in the browser,
completely inert: `monaco-editor/editor/editor.api` ships the API surface with
**no editor contributions**, so there was no suggest widget, no hover, no
folding controls and no snippet insertion. The editor mounted, painted and
highlighted perfectly — and did nothing when you typed.

Nothing short of driving a browser could have caught that, which is the whole
point of this file. See `src/lib/editor/monaco-contributions.ts`.

## Running it

Two things must be up first:

```sh
# 1. the web app
pnpm --filter @glyphtex/web dev --port 5199

# 2. headless Chrome with a debugging port
chrome --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/chrome-smoke about:blank
```

Override the defaults with `PAGE` and `CDP` environment variables if you use
different ports.

## Limitations

- Not part of `pnpm test` — it needs a running server and a browser, so it is a
  deliberate manual/CI step rather than something that runs on every change.
- It removes the first-run compiler dialog from the DOM to reach the editor
  underneath. That is a harness step; it does not exercise the install flow.
- It asserts on Monaco's own DOM class names (`.suggest-widget`,
  `.monaco-list-row`, `.mtk*`), which are internal and can change across Monaco
  upgrades. If it fails right after a version bump, check these first.
