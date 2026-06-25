// Theme entry point.
//
// The single owner of the theme fact is the settings store (`glyphx:appearance`,
// see lib/state/settings.svelte.ts). Everything that needs the theme reads it
// from `settings` — do NOT reintroduce `mode-watcher` here: a second source
// would drift from the store and re-open the class-vs-store theme bug
// (AGENTS.md §3, single owner per fact).
export { settings } from "@glyphx/ui/settings";
export type { Appearance, ResolvedTheme } from "@glyphx/ui/settings";
