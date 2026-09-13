import type { Update } from "@tauri-apps/plugin-updater";
import { isTauriRuntime } from "$lib/runtime";

/**
 * Desktop auto-updater. Checks `latest.json` on boot; download and install each wait for the user.
 * Plugins load lazily so the module is safe outside Tauri.
 */
export type UpdaterStatus =
	| "idle"
	| "unavailable"
	| "checking"
	| "up-to-date"
	| "update-available"
	| "downloading"
	| "ready"
	| "error";

/** Which step failed, so Retry repeats that step instead of always re-checking. */
export type UpdaterFailure = "check" | "download" | "install";

export const FAILURE_COPY: Record<UpdaterFailure, { title: string; body: string }> = {
	check: {
		title: "Couldn't check for updates",
		body: "GlyphTeX couldn't reach the update server. Check your connection and try again."
	},
	download: {
		title: "Download failed",
		body: "The update didn't finish downloading. Nothing was installed."
	},
	install: {
		title: "Install failed",
		body: "The update couldn't be installed. Your current version still works."
	}
};

function createUpdaterStore() {
	let status = $state<UpdaterStatus>("idle");
	let version = $state<string | null>(null);
	let notes = $state<string | null>(null);
	let received = $state(0);
	let total = $state(0);
	let error = $state<string | null>(null);
	let failedStep = $state<UpdaterFailure | null>(null);
	let dismissed = $state(false);
	let installing = $state(false);
	let manual = $state(false);

	let update: Update | null = null;

	function fail(step: UpdaterFailure, e: unknown) {
		console.error(`[updater] ${step} failed`, e);
		error = e instanceof Error ? e.message : String(e);
		failedStep = step;
		status = "error";
	}

	async function runDownload() {
		if (!update || status === "downloading") return;
		received = 0;
		total = 0;
		error = null;
		failedStep = null;
		status = "downloading";
		try {
			await update.download((ev) => {
				switch (ev.event) {
					case "Started":
						total = ev.data.contentLength ?? 0;
						break;
					case "Progress":
						received += ev.data.chunkLength;
						break;
					case "Finished":
						if (total > 0) received = total;
						break;
				}
			});
			status = "ready";
		} catch (e) {
			fail("download", e);
		}
	}

	async function runCheck(isManual: boolean) {
		// `tauri dev` builds are unsigned and unpublished, so there is nothing honest to compare against.
		if (import.meta.env.DEV || !isTauriRuntime()) {
			if (isManual) {
				manual = true;
				status = "unavailable";
			}
			return;
		}
		if (status === "checking" || status === "downloading") return;
		manual = isManual;
		error = null;
		failedStep = null;
		status = "checking";
		try {
			const { check } = await import("@tauri-apps/plugin-updater");
			const found = await check();
			if (!found) {
				update = null;
				version = null;
				status = "up-to-date";
				return;
			}
			update = found;
			version = found.version;
			notes = found.body ?? null;
			dismissed = false;
			status = "update-available";
		} catch (e) {
			fail("check", e);
		}
	}

	async function runInstall() {
		if (!update || installing) return;
		installing = true;
		error = null;
		failedStep = null;
		status = "ready";
		try {
			await update.install();
			const { relaunch } = await import("@tauri-apps/plugin-process");
			await relaunch();
		} catch (e) {
			installing = false;
			fail("install", e);
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
		/** 0..1, or null while the server has not sent a content length. */
		get progress() {
			return total > 0 ? Math.min(received / total, 1) : null;
		},
		get receivedBytes() {
			return received;
		},
		get totalBytes() {
			return total;
		},
		get error() {
			return error;
		},
		get failedStep() {
			return failedStep;
		},
		get installing() {
			return installing;
		},
		/** True when the latest check was started by the user. */
		get manual() {
			return manual;
		},

		/** The corner card only renders when there is something to act on. */
		get visible() {
			if (dismissed) return false;
			return (
				status === "update-available" ||
				status === "downloading" ||
				status === "ready" ||
				// Failed checks stay off the card: boot checks fail offline, manual ones show in About.
				(status === "error" && failedStep !== "check")
			);
		},

		/** Boot-time check. Silent unless an update exists. */
		init() {
			void runCheck(false);
		},

		/** User-initiated check from Settings > About. */
		checkNow() {
			return runCheck(true);
		},

		download() {
			return runDownload();
		},

		/** Repeat the step that failed. */
		retry() {
			if (failedStep === "download" && update) return runDownload();
			if (failedStep === "install" && update) return runInstall();
			return runCheck(manual);
		},

		/** Hide the corner card until the next check finds something new. */
		dismiss() {
			dismissed = true;
		},

		installAndRelaunch() {
			if (status !== "ready") return;
			return runInstall();
		}
	};
}

export const updater = createUpdaterStore();
