import { invoke } from "@tauri-apps/api/core";
import type {
	CacheInfo,
	EngineManager,
	EngineVersion,
	PrefetchResult,
	SystemTexInfo
} from "@glyphtex/ui/application";

/** Shape returned by the Rust `prefetch_packages` command (its own struct: not
 *  the compile result; see compile.ts for that contract). */
type RawPrefetchResult = { success: boolean; message: string | null };

/** Desktop engine manager: Tectonic versions from GitHub releases plus package-cache controls. */
// The backend joins `version` into a path, so anything but a release tag could escape the engines dir.
async function tag(version: string): Promise<string> {
	if (!/^(nightly|v?\d+\.\d+\.\d+(-[\w.]+)?)$/.test(version)) {
		throw new Error(`"${version}" isn't a Tectonic release version.`);
	}
	return version;
}

export const engineManager: EngineManager = {
	label: "Tectonic",
	list: () => invoke<EngineVersion[]>("list_tectonic_versions"),
	download: async (version: string) =>
		invoke<string>("download_tectonic", { version: await tag(version) }),
	setActive: async (version: string) =>
		invoke<void>("set_active_engine", { version: await tag(version) }),
	remove: async (version: string) =>
		invoke<void>("remove_tectonic", { version: await tag(version) }),
	detectSystem: () => invoke<SystemTexInfo>("detect_system_tex"),
	cacheInfo: () => invoke<CacheInfo>("tectonic_cache_info"),
	clearCache: () => invoke<void>("clear_tectonic_cache"),
	prefetch: async (): Promise<PrefetchResult> => {
		const r = await invoke<RawPrefetchResult>("prefetch_packages");
		return { success: r.success, message: r.message ?? undefined };
	}
};
