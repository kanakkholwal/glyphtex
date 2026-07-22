/** Per-document ceiling. Not a browser limit — it keeps one document from
 *  eating the whole origin quota and getting everything evicted. */
export const PER_PROJECT_BYTES = 100 * 1024 * 1024;

/** Single-file ceiling, so one pasted image cannot fill a document. */
export const PER_FILE_BYTES = 20 * 1024 * 1024;

/** Fraction of the granted quota above which the UI warns. */
export const WARN_AT = 0.8;

export type StorageStatus = {
	/** Bytes this origin currently uses, per the browser. */
	usage: number;
	/** Bytes the browser is willing to grant. 0 when it will not say. */
	quota: number;
	/** usage/quota, or 0 when quota is unknown. */
	ratio: number;
	/** Data is exempt from eviction under storage pressure. */
	persisted: boolean;
	/** The browser refused to report — show "unknown", never "0 bytes used". */
	unknown: boolean;
};

export async function storageStatus(): Promise<StorageStatus> {
	const empty: StorageStatus = { usage: 0, quota: 0, ratio: 0, persisted: false, unknown: true };
	if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return empty;

	try {
		const { usage = 0, quota = 0 } = await navigator.storage.estimate();
		const persisted = (await navigator.storage.persisted?.()) ?? false;
		return { usage, quota, ratio: quota > 0 ? usage / quota : 0, persisted, unknown: false };
	} catch {
		return empty;
	}
}

/**
 * Ask the browser to exempt this origin from eviction. **Call this from a click
 * handler** — Firefox only shows its prompt during a user gesture, and a
 * gesture-less call just resolves false without ever asking.
 */
export async function requestPersistence(): Promise<boolean> {
	if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
	try {
		if (await navigator.storage.persisted?.()) return true;
		return await navigator.storage.persist();
	} catch {
		return false;
	}
}

/**
 * The `persistent-storage` permission as the browser sees it. Distinguishes a
 * hard `denied` (asking again is pointless) from `prompt` (Chrome's engagement
 * heuristics not met yet). `unsupported` in Safari/Firefox, which do not expose it.
 */
export async function persistencePermission(): Promise<PermissionState | 'unsupported'> {
	if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unsupported';
	try {
		const status = await navigator.permissions.query({
			name: 'persistent-storage' as PermissionName
		});
		return status.state;
	} catch {
		return 'unsupported';
	}
}

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / 1024 ** i;
	return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
