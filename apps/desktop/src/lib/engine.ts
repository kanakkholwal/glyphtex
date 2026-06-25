import { invoke } from '@tauri-apps/api/core';
import type {
	CacheInfo,
	EngineManager,
	EngineVersion,
	PrefetchResult,
	SystemTexInfo
} from '@glyphx/ui/application';

/** Shape returned by the Rust `prefetch_packages` command (its own struct — not
 *  the compile result; see compile.ts for that contract). */
type RawPrefetchResult = { success: boolean; message: string | null };

/**
 * Desktop engine manager — lists, downloads, and activates Tectonic versions
 * from GitHub releases (Rust `engine` module), plus managed package-cache
 * controls. Lets users update the LaTeX engine without rebuilding the app.
 */
export const engineManager: EngineManager = {
	label: 'Tectonic',
	list: () => invoke<EngineVersion[]>('list_tectonic_versions'),
	download: (version: string) => invoke<string>('download_tectonic', { version }),
	setActive: (version: string) => invoke<void>('set_active_engine', { version }),
	remove: (version: string) => invoke<void>('remove_tectonic', { version }),
	detectSystem: () => invoke<SystemTexInfo>('detect_system_tex'),
	cacheInfo: () => invoke<CacheInfo>('tectonic_cache_info'),
	clearCache: () => invoke<void>('clear_tectonic_cache'),
	prefetch: async (): Promise<PrefetchResult> => {
		const r = await invoke<RawPrefetchResult>('prefetch_packages');
		return { success: r.success, message: r.message ?? undefined };
	}
};
