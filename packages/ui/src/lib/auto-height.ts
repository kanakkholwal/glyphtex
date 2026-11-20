import type { Attachment } from "svelte/attachments";

/**
 * Animates an element's height to follow its first child, so swapping content (tabs, steps)
 * eases the container instead of jumping. The first child must contain its children's margins
 * (give it `flow-root`), or a child's top margin escapes it and the last line is clipped.
 * Reduced motion jumps.
 */
export function autoHeight(): Attachment<HTMLElement> {
	return (host) => {
		const inner = host.firstElementChild;
		if (!inner) return;
		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
		host.style.overflow = "clip";
		host.style.overflowClipMargin = "8px";
		host.style.height = `${(inner as HTMLElement).offsetHeight}px`;

		// The first frame jumps to the measured height; later changes ease.
		const frame = requestAnimationFrame(() => {
			host.style.transition = "height var(--duration-slow) var(--ease-out)";
		});
		const watch = new ResizeObserver(() => {
			host.style.transition = reduced.matches
				? "none"
				: "height var(--duration-slow) var(--ease-out)";
			host.style.height = `${(inner as HTMLElement).offsetHeight}px`;
		});
		watch.observe(inner);
		return () => {
			cancelAnimationFrame(frame);
			watch.disconnect();
		};
	};
}
