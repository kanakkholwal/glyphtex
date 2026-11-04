import { PersistedState } from "@glyphtex/ui/persisted-state";
import { SvelteMap } from "svelte/reactivity";

import { cloudSession } from "$lib/cloud/session.svelte";
import { notifyTreeChanged } from "$lib/git";
import { listProjects } from "$lib/storage/projects";
import { linkProject, type SyncResult, syncProject } from "./engine";

export type SyncMode = "automatic" | "manual";
export type SyncState = "syncing" | "synced" | "conflict" | "error";

// Long enough to batch a burst of saves into one round trip.
const PUSH_DELAY_MS = 2_000;

/** Owns the sync preference and each linked project's live sync state. */
class Sync {
	#mode = new PersistedState<SyncMode>("glyphtex:sync-mode", "manual");
	state = new SvelteMap<string, SyncState>();
	errors = new SvelteMap<string, string>();
	#timers = new Map<string, ReturnType<typeof setTimeout>>();
	#running = new Map<string, Promise<SyncResult>>();

	get mode() {
		return this.#mode.current;
	}
	set mode(value: SyncMode) {
		this.#mode.current = value;
		if (value === "automatic") void this.linkAll();
	}
	get automatic() {
		return this.mode === "automatic" && cloudSession.signedIn;
	}

	/** Runs one sync per project at a time; a second call waits for the first. */
	run(localId: string): Promise<SyncResult> {
		const inFlight = this.#running.get(localId);
		if (inFlight) return inFlight;
		this.state.set(localId, "syncing");
		const job = syncProject(localId)
			.then((r) => {
				this.state.set(localId, r.conflicts.length ? "conflict" : "synced");
				this.errors.delete(localId);
				// An open editor reloads instead of saving over what was just pulled.
				if (r.pulled > 0) notifyTreeChanged(localId);
				return r;
			})
			.catch((e: unknown) => {
				this.state.set(localId, "error");
				this.errors.set(localId, e instanceof Error ? e.message : "Sync failed.");
				throw e;
			})
			.finally(() => this.#running.delete(localId));
		this.#running.set(localId, job);
		return job;
	}

	/** Called after every local save; pushes soon when sync is automatic, otherwise does nothing. */
	saved(localId: string, linked: boolean) {
		if (!linked || !this.automatic) return;
		clearTimeout(this.#timers.get(localId));
		this.#timers.set(
			localId,
			setTimeout(() => void this.run(localId).catch(() => {}), PUSH_DELAY_MS)
		);
	}

	/** Automatic mode: every personal browser document gets a server copy, one at a time. */
	async linkAll(): Promise<number> {
		if (!this.automatic) return 0;
		let linked = 0;
		for (const p of await listProjects()) {
			if (p.remote) continue;
			try {
				await linkProject(p.id);
				this.state.set(p.id, "synced");
				linked++;
			} catch (e) {
				this.errors.set(p.id, e instanceof Error ? e.message : "Could not link.");
			}
		}
		return linked;
	}
}

export const sync = new Sync();
