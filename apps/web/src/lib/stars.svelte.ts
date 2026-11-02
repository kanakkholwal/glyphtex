import { REPO_SLUG } from "$lib/landing/nav-data";

const CACHE_KEY = "glyphtex:repo-stars";
// GitHub allows 60 unauthenticated calls an hour per IP; one per visitor per hour stays far below.
const FRESH_MS = 60 * 60 * 1000;

type Cached = { stars: number; at: number };

let stars = $state<number | null>(null);
let requested = false;

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

function readCache(): Cached | null {
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
		const c = parsed as Partial<Cached> | null;
		return c && isCount(c.stars) && isCount(c.at) ? { stars: c.stars, at: c.at } : null;
	} catch {
		// Storage blocked or the entry is corrupt: behave as if nothing was cached.
		return null;
	}
}

function writeCache(value: number) {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify({ stars: value, at: Date.now() }));
	} catch {
		// Private windows can refuse writes; the count still shows for this page.
	}
}

/** The repo's star count from the GitHub API, cached per browser for an hour; null hides it. */
export const repoStars = {
	get value() {
		return stars;
	},
	load() {
		if (requested) return;
		requested = true;
		const cached = readCache();
		if (cached) stars = cached.stars;
		if (cached && Date.now() - cached.at < FRESH_MS) return;
		fetch(`https://api.github.com/repos/${REPO_SLUG}`, {
			headers: { accept: "application/vnd.github+json" }
		})
			.then((res) => (res.ok ? res.json() : null))
			.then((body: unknown) => {
				const value = (body as { stargazers_count?: unknown } | null)?.stargazers_count;
				if (!isCount(value)) return;
				stars = value;
				writeCache(value);
			})
			// Offline or rate limited: keep the stale count, or hide it when there is none.
			.catch(() => {});
	}
};
