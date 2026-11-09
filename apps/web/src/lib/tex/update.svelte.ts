import { updateEngine, type InstallProgress } from "$lib/compile";
import { checkEngineUpdate } from "./update";
import type { UpdatePlan } from "./update-plan";

const HOUR_MS = 60 * 60 * 1000;
const LAST_CHECK = "glyphtex:engine-checked";

function lastCheck(): number {
	try {
		return Number(localStorage.getItem(LAST_CHECK)) || 0;
	} catch {
		return 0;
	}
}

function markChecked(): void {
	try {
		localStorage.setItem(LAST_CHECK, String(Date.now()));
	} catch {
		/* a throttle only: without storage the check simply runs again */
	}
}

/**
 * Looks for a newer compiler once per page load and then at most once an hour.
 * Owns the result; the dialog reads it and calls `apply` or `dismiss`.
 */
class EngineUpdates {
	available = $state<UpdatePlan | null>(null);
	/** Signature of an update the user chose "Later" on. */
	#dismissed = $state<string | null>(null);
	#started = false;
	#running = false;

	/** Shown unless the user already postponed this exact update. */
	get visible(): boolean {
		return this.available !== null && this.available.signature !== this.#dismissed;
	}

	/** Safe to call from every editor: only the first call starts the watcher. */
	start(): void {
		if (this.#started || typeof document === "undefined") return;
		this.#started = true;
		void this.check(true);
		setInterval(() => void this.check(), HOUR_MS);
		// A laptop that slept through the interval catches up when the tab returns.
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") void this.check();
		});
	}

	async check(force = false): Promise<void> {
		if (this.#running || (!force && Date.now() - lastCheck() < HOUR_MS)) return;
		this.#running = true;
		try {
			this.available = await checkEngineUpdate();
			markChecked();
		} finally {
			this.#running = false;
		}
	}

	dismiss(): void {
		this.#dismissed = this.available?.signature ?? null;
	}

	async apply(onProgress?: (p: InstallProgress) => void): Promise<void> {
		await updateEngine(onProgress);
		this.available = null;
		this.#dismissed = null;
	}
}

export const engineUpdates = new EngineUpdates();
