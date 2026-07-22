import { safeStorage } from '@glyphtex/ui/persisted-state';
import { engineManager } from './engine';

/**
 * localStorage flag remembering the common-package cache was warmed. Versioned
 * so we can force a re-warm later if the bundled package set in
 * `prefetch_packages` (Rust) changes — bump the suffix to invalidate.
 */
const PREFETCH_FLAG = 'glyphtex:pkg-prefetch:v1';

/**
 * Warm the LaTeX package cache once, automatically, on first launch.
 *
 * Tectonic fetches each package from the web on first use, so a brand-new
 * install's first *offline* compile fails until the cache holds the common
 * packages. Rather than make the user discover the "Prefetch common" button in
 * Settings (after hitting that error), we do it for them on first run and
 * remember success via the shared `safeStorage` helper.
 *
 * Best-effort and silent: a failure (offline, or the engine isn't present yet)
 * leaves the flag unset so a later launch retries, instead of permanently
 * skipping the warm-up.
 */
export async function prefetchCommonPackagesOnce(): Promise<void> {
	if (safeStorage.get(PREFETCH_FLAG, false)) return;
	if (!engineManager.prefetch) return;
	try {
		const r = await engineManager.prefetch();
		if (r.success) safeStorage.set(PREFETCH_FLAG, true);
	} catch {
		/* offline or engine not yet available — retry on a future launch */
	}
}
