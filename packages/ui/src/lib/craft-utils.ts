export const CRAFT_TRANSITION = "transition-all duration-200 ease-in-out";

/** The app's one motion ease. Snappy but never jittery — use for state-driven
 *  transitions that should feel intentional and stay out of the way. */
export const CRAFT_EASE = "cubic-bezier(0.625, 0.05, 0, 1)";

/** Enter/exit for any bits-ui `*.Content`. Small scale and slide, so it reads as
 *  "settle into place" rather than "pop". */
export const CRAFT_OVERLAY_ANIMATION = [
	"data-[state=open]:animate-in data-[state=closed]:animate-out",
	"data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
	"data-[state=open]:zoom-in-[0.98] data-[state=closed]:zoom-out-[0.98]",
	"data-[side=bottom]:slide-in-from-top-1",
	"data-[side=top]:slide-in-from-bottom-1",
	"data-[side=left]:slide-in-from-right-1",
	"data-[side=right]:slide-in-from-left-1",
	"data-[side=inline-start]:slide-in-from-right-1",
	"data-[side=inline-end]:slide-in-from-left-1",
	"duration-200 data-[state=closed]:duration-150 ease-[cubic-bezier(0.625,0.05,0,1)]",
].join(" ");

/** Dialog/drawer backdrops: pure fade, no scale or slide. */
export const CRAFT_OVERLAY_BACKDROP_ANIMATION = [
	"data-[state=open]:animate-in data-[state=closed]:animate-out",
	"data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
	"duration-200 data-[state=closed]:duration-150 ease-[cubic-bezier(0.625,0.05,0,1)]",
].join(" ");

/** Hidden until the parent `group` is hovered or something inside takes focus. */
export const INVISIBLE_UI = "opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200";

export const GLASS_PANEL = "bg-white/70 dark:bg-black/70 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-craft-floating";

export const BLOCK_BASE = "p-6 md:p-8 rounded-3xl bg-card transition-all duration-200";
export const BLOCK_HOVER = "hover:scale-[1.005] hover:bg-card/80 active:scale-[0.995]";
