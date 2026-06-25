import type { Update } from '@tauri-apps/plugin-updater';
import { isTauriRuntime } from '$lib/runtime';

/**
 * Auto-updater store (desktop only).
 *
 * Flow: on app boot we ask the Tauri updater plugin to compare the running
 * build against the `latest.json` manifest published with each GitHub release.
 * If a newer version exists we surface a non-blocking corner card — the
 * download does NOT start until the user opts in, and install + relaunch is
 * deferred until they explicitly click "Restart to update". This matches the
 * explicit-consent behaviour users expect and is kind to metered connections.
 *
 * All updater/process APIs are imported lazily so the module is safe to load in
 * the browser (web build) where the Tauri plugins don't exist.
 */
export type UpdaterStatus =
	| 'idle'
	| 'checking'
	| 'up-to-date'
	| 'update-available'
	| 'downloading'
	| 'ready'
	| 'error';

function createUpdaterStore() {
	let status = $state<UpdaterStatus>('idle');
	let version = $state<string | null>(null);
	let notes = $state<string | null>(null);
	let progress = $state(0); // 0..1, only meaningful while downloading
	let error = $state<string | null>(null);
	let dismissed = $state(false);
	let installing = $state(false);
	// Tracks whether the most recent check was user-initiated, so the "you're up
	// to date" result can be surfaced (a boot check stays silent when current).
	let manual = $state(false);

	// The resolved Update handle, held across the download → install steps.
	let update: Update | null = null;

	async function runDownload() {
		if (!update) return;
		let total = 0;
		let received = 0;
		progress = 0;
		status = 'downloading';
		try {
			await update.download((ev) => {
				switch (ev.event) {
					case 'Started':
						total = ev.data.contentLength ?? 0;
						break;
					case 'Progress':
						received += ev.data.chunkLength;
						progress = total > 0 ? Math.min(received / total, 1) : 0;
						break;
					case 'Finished':
						progress = 1;
						break;
				}
			});
			status = 'ready';
		} catch (e) {
			console.error('[updater] download failed', e);
			error = e instanceof Error ? e.message : String(e);
			status = 'error';
		}
	}

	async function runCheck(isManual: boolean) {
		// Production-only. `tauri dev` ships an unsigned, unpublished build, so
		// the plugin can't compare against `latest.json` meaningfully — and the
		// corner card during local dev just confuses contributors. Vite's DEV
		// flag short-circuits cleanly for `tauri dev` while staying live for
		// `tauri build` artefacts.
		if (import.meta.env.DEV || !isTauriRuntime()) {
			if (isManual) {
				manual = true;
				status = 'up-to-date';
			}
			return;
		}
		if (status === 'checking' || status === 'downloading') return;
		manual = isManual;
		error = null;
		status = 'checking';
		try {
			const { check } = await import('@tauri-apps/plugin-updater');
			const found = await check();
			if (!found) {
				update = null;
				version = null;
				status = 'up-to-date';
				return;
			}
			update = found;
			version = found.version;
			notes = found.body ?? null;
			dismissed = false;
			// Don't auto-download — surface the card and wait for the user.
			status = 'update-available';
		} catch (e) {
			console.error('[updater] check failed', e);
			error = e instanceof Error ? e.message : String(e);
			status = 'error';
		}
	}

	return {
		get status() {
			return status;
		},
		get version() {
			return version;
		},
		get notes() {
			return notes;
		},
		get progress() {
			return progress;
		},
		get error() {
			return error;
		},
		get installing() {
			return installing;
		},
		/** True while a user-initiated check is in flight or just resolved. */
		get manual() {
			return manual;
		},

		/**
		 * Whether the corner card should render. Silent while idle / checking /
		 * up to date — it only appears once there's something actionable.
		 */
		get visible() {
			if (dismissed) return false;
			return (
				status === 'update-available' ||
				status === 'downloading' ||
				status === 'ready' ||
				status === 'error'
			);
		},

		/** Boot-time check. Fire-and-forget; stays silent unless an update exists. */
		init() {
			void runCheck(false);
		},

		/** User-initiated check (settings → About). Surfaces an "up to date" result. */
		checkNow() {
			return runCheck(true);
		},

		/** User-triggered download (from the corner card's Download button). */
		download() {
			return runDownload();
		},

		/** Hide the corner card until the next check finds something new. */
		dismiss() {
			dismissed = true;
		},

		/** Install the downloaded update and relaunch. */
		async installAndRelaunch() {
			if (!update || status !== 'ready' || installing) return;
			installing = true;
			try {
				await update.install();
				const { relaunch } = await import('@tauri-apps/plugin-process');
				await relaunch();
			} catch (e) {
				console.error('[updater] install failed', e);
				error = e instanceof Error ? e.message : String(e);
				status = 'error';
				installing = false;
			}
		}
	};
}

export const updater = createUpdaterStore();
