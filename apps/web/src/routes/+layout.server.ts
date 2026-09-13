import { repoStars } from "$lib/server/github";
import type { LayoutServerLoad } from "./$types";

// Not awaited, so SSR pages stream; prerendered pages bake the count in at build time.
export const load: LayoutServerLoad = ({ fetch }) => ({ stars: repoStars(fetch) });
