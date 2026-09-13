import { REPO_SLUG } from "$lib/landing/nav-data";

/** Live star count, or null when GitHub is slow or unavailable, so the number hides instead of lying. */
export async function repoStars(fetcher: typeof fetch): Promise<number | null> {
	try {
		const res = await fetcher(`https://api.github.com/repos/${REPO_SLUG}`, {
			headers: { accept: "application/vnd.github+json", "user-agent": "glyphtex-web" },
			signal: AbortSignal.timeout(1500),
			// Workers edge-caches the subrequest, so the 60/hour unauthenticated limit is never reached.
			cf: { cacheTtl: 3600, cacheEverything: true }
		} as RequestInit);
		if (!res.ok) return null;
		const body: unknown = await res.json();
		const stars = (body as { stargazers_count?: unknown }).stargazers_count;
		return typeof stars === "number" && Number.isFinite(stars) ? stars : null;
	} catch {
		return null;
	}
}
