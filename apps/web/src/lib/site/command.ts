const OPEN_EVENT = "glyphtex:site-command";

/** Opens the site's ⌘K menu from anywhere; a window event, so no provider has to wrap the trigger. */
export function openSiteCommand() {
	window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onSiteCommandOpen(handler: () => void) {
	window.addEventListener(OPEN_EVENT, handler);
	return () => window.removeEventListener(OPEN_EVENT, handler);
}
