/** Attachment that marks an element `data-revealed` the first time it nears the viewport,
 *  pairing with the `.reveal` utility (app.css) for a one-shot fade/rise entrance. */
export function revealOnScroll(node: HTMLElement) {
	if (typeof IntersectionObserver === "undefined") {
		node.setAttribute("data-revealed", "");
		return;
	}
	const io = new IntersectionObserver(
		(entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			node.setAttribute("data-revealed", "");
			io.disconnect();
		},
		{ rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
	);
	io.observe(node);
	return () => io.disconnect();
}

/** Inline `transition-delay` for a staggered cascade; caps so a long list doesn't crawl in. */
export function staggerDelay(index: number, stepMs = 60, maxMs = 240): string {
	return `transition-delay: ${Math.min(index * stepMs, maxMs)}ms`;
}
