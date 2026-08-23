import { trackOnce } from "./index";

/** Attachment that reports a landing section the first time it is actually read,
 *  so the funnel shows how far down the page a visit got. */
export function viewSection(section: string) {
	return (node: HTMLElement) => {
		if (typeof IntersectionObserver === "undefined") return;
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				io.disconnect();
				trackOnce(`section:${section}`, "section_viewed", { section });
			},
			// Fires once the section reaches the middle band of the viewport. A
			// ratio threshold would never fire for a section taller than the screen.
			{ rootMargin: "-25% 0px -25% 0px" }
		);
		io.observe(node);
		return () => io.disconnect();
	};
}
