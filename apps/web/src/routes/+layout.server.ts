import { repoStars } from "$lib/server/github";
import type { LayoutServerLoad } from "./$types";

// Awaited, not streamed: a streamed promise sends 200 headers before an error page can set 404.
// The budget keeps a cold GitHub call from holding the page; null hides the count.
const STARS_BUDGET_MS = 300;

export const load: LayoutServerLoad = async ({ fetch }) => ({
	stars: await Promise.race([
		repoStars(fetch),
		new Promise<null>((done) => setTimeout(() => done(null), STARS_BUDGET_MS))
	])
});
