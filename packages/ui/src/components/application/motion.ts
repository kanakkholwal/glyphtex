import { cubicOut } from "svelte/easing";
import { MediaQuery } from "svelte/reactivity";

const reduced = new MediaQuery("prefers-reduced-motion: reduce");

/** Duration in ms, or 0 under reduced motion: Svelte transitions bypass the CSS guard. */
export function motionMs(ms: number): number {
	return reduced.current ? 0 : ms;
}

/** Params for the panels' 200ms disclosure slide. */
export function reveal(): { duration: number; easing: (t: number) => number } {
	return { duration: motionMs(200), easing: cubicOut };
}
