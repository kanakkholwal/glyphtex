// The settings store owns the theme. Never add `mode-watcher` here: a second source
// drifts and reopens the class-vs-store theme bug.
export { settings } from "@glyphtex/ui/settings";
export type { Appearance, ResolvedTheme } from "@glyphtex/ui/settings";
