import type { PersistedStateOptions } from "@glyphtex/ui/persisted-state";

/** The value-independent half of the options, so one policy fits every key's type. */
type StoragePolicy = Pick<PersistedStateOptions<never>, "storage" | "syncTabs">;

export const LAYOUT_KEYS = {
	activeView: "glyphtex:layout:active-view",
	panelCollapsed: "glyphtex:layout:panel-collapsed",
	docMode: "glyphtex:layout:doc-mode",
	viewMode: "glyphtex:layout:view-mode",
	dockTab: "glyphtex:layout:dock-tab",
	rightPanel: "glyphtex:layout:right-panel",
	splitDir: "glyphtex:layout:split-dir",
	thumbsOpen: "glyphtex:layout:thumbs-open",
	splitPct: "glyphtex:layout:split-pct",
	sidebarW: "glyphtex:layout:sidebar-width",
	dockH: "glyphtex:layout:dock-height"
} as const;

/**
 * Where you are in *this* window: which panel is open, which surface you're on.
 * Session-scoped so a second tab on another project opens clean instead of
 * inheriting, so `visual` can never strand a fresh tab on the specimen pane.
 */
export const TAB_CONTEXT: StoragePolicy = { storage: "session" };

/** A taste preference: durable, and worth following into every open window. */
export const PREFERENCE: StoragePolicy = { storage: "local" };

/**
 * Durable like a preference, but `syncTabs: false`: these are committed on drag
 * end, and a resize in one window should not animate the others mid-gesture.
 */
export const GEOMETRY: StoragePolicy = { storage: "local", syncTabs: false };
