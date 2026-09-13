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
	"duration-200 data-[state=closed]:duration-150 ease-craft"
].join(" ");

/** Dialog/drawer backdrops: pure fade, no scale or slide. */
export const CRAFT_OVERLAY_BACKDROP_ANIMATION = [
	"data-[state=open]:animate-in data-[state=closed]:animate-out",
	"data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
	"duration-200 data-[state=closed]:duration-150 ease-craft"
].join(" ");

/** Modal scrim. Fixed ink, so it dims both themes the same way. */
export const CRAFT_SCRIM = "bg-fixed-dark/40";

/** Floating surface shared by every menu, popover and dialog. */
export const CRAFT_OVERLAY_SURFACE =
	"bg-popover text-popover-foreground border border-border rounded-xl shadow-lg";

/** Keyboard focus for a standalone control: 2px `--ring` with a 2px offset. */
export const CRAFT_FOCUS_RING =
	"outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Inset variant for rows inside scroll areas, where an outer ring would clip. */
export const CRAFT_FOCUS_RING_INSET =
	"outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
