import { browser } from "$app/environment";
import { authClient, type CloudUser } from "./auth";
import { cloudEnabled } from "./config";

type Status = "idle" | "loading" | "ready" | "error";

/** The signed-in user, owned here; components read it and call `refresh` after auth changes. */
class CloudSession {
	user = $state<CloudUser | null>(null);
	status = $state<Status>("idle");
	#pending: Promise<void> | null = null;

	get signedIn() {
		return this.user !== null;
	}

	/** First read is shared, so every component mounting at once makes one request. */
	ensure(): Promise<void> {
		if (!browser || !cloudEnabled) return Promise.resolve();
		if (this.status === "ready") return Promise.resolve();
		this.#pending ??= this.refresh().finally(() => (this.#pending = null));
		return this.#pending;
	}

	async refresh(): Promise<void> {
		if (!browser || !cloudEnabled) return;
		this.status = "loading";
		try {
			const { data } = await authClient.getSession();
			this.user = data?.user ?? null;
			this.status = "ready";
		} catch {
			// The server being down must not block local documents; treat as signed out.
			this.user = null;
			this.status = "error";
		}
	}

	async signOut(): Promise<void> {
		await authClient.signOut();
		this.user = null;
	}
}

export const cloudSession = new CloudSession();
