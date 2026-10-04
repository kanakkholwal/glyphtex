import { REPO_SLUG } from "$lib/landing/nav-data";

const FRESH_MS = 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;

// Public repo data, so a module-scope cache is safe across requests. It also covers dev and
// cold isolates, where the `cf` edge cache below does not apply.
let lastGood: number | null = null;
let nextFetchAt = 0;
let inflight: Promise<number | null> | null = null;

/** Live star count, or the last good one when GitHub is slow, failing or rate limited; null hides it. */
export function repoStars(fetcher: typeof fetch): Promise<number | null> {
	if (Date.now() < nextFetchAt) return Promise.resolve(lastGood);
	inflight ??= fetchStars(fetcher).finally(() => {
		inflight = null;
	});
	return inflight;
}

async function fetchStars(fetcher: typeof fetch): Promise<number | null> {
	try {
		const res = await fetcher(`https://api.github.com/repos/${REPO_SLUG}`, {
			headers: { accept: "application/vnd.github+json", "user-agent": "glyphtex-web" },
			signal: AbortSignal.timeout(1500),
			cf: { cacheTtl: 3600, cacheEverything: true }
		} as RequestInit);
		if (!res.ok) {
			nextFetchAt = retryAt(res);
			return lastGood;
		}
		const body: unknown = await res.json();
		const stars = (body as { stargazers_count?: unknown }).stargazers_count;
		if (typeof stars !== "number" || !Number.isFinite(stars)) {
			nextFetchAt = Date.now() + RETRY_MS;
			return lastGood;
		}
		lastGood = stars;
		nextFetchAt = Date.now() + FRESH_MS;
		return stars;
	} catch {
		nextFetchAt = Date.now() + RETRY_MS;
		return lastGood;
	}
}

/** On a rate limit, GitHub sends the reset time; wait for it instead of spending the next request. */
function retryAt(res: Response): number {
	const reset = Number(res.headers.get("x-ratelimit-reset"));
	const limited = res.status === 403 || res.status === 429;
	if (limited && Number.isFinite(reset) && reset > 0) {
		return Math.min(reset * 1000, Date.now() + FRESH_MS);
	}
	return Date.now() + RETRY_MS;
}
