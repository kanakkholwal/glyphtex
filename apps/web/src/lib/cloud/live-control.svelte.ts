import { live } from "@glyphtex/ui/live";

import type { DocumentMeta } from "$lib/documents/store";
import { type ServerInfo, cloud } from "./api";
import { SERVER_URL } from "./config";
import { cloudSession } from "./session.svelte";

// Cursor colours the editor can show next to a name; picked from the user id so it stays stable.
const COLORS = ["#0f6fde", "#d9481c", "#1a8f5c", "#a23bd1", "#c28a00", "#cc3c6e"];
const colorOf = (id: string) =>
	COLORS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % COLORS.length] as string;

const minutes = (seconds: number) => Math.round(seconds / 60);
const hours = (seconds: number) => Math.round((seconds / 3600) * 10) / 10;

/** Live editing for one document: whether it is offered, on, and why a session ended. */
export class LiveControl {
	readonly #document: () => DocumentMeta;
	// Unknown until the server answers; only a definite no disables the control.
	info = $state<ServerInfo | undefined>(undefined);

	constructor(document: () => DocumentMeta) {
		this.#document = document;
	}

	get on(): boolean {
		return live.config !== null;
	}
	get supported(): boolean | undefined {
		return this.info ? this.info.features.live : undefined;
	}
	get limits() {
		return this.info?.limits.live;
	}
	get available(): boolean {
		return Boolean(this.#document().remoteId) && cloudSession.signedIn;
	}
	get status(): string {
		return live.status === "live"
			? "Live"
			: live.status === "connecting" || live.status === "offline"
				? "Connecting…"
				: "";
	}
	get limitText(): string | undefined {
		const limits = this.limits;
		return limits
			? `Up to ${limits.maxEditors} people per file. Disconnects after ${minutes(limits.idleSeconds)} minutes without typing, and sessions last up to ${hours(limits.maxSessionSeconds)} hours. Edits keep syncing normally either way.`
			: undefined;
	}
	get disabledReason(): string | undefined {
		return this.supported === false
			? "This server does not have live editing enabled. On Cloudflare it needs the ROOMS Durable Object binding."
			: undefined;
	}

	loadInfo(): void {
		void cloud
			.info()
			.then((i) => (this.info = i))
			.catch(() => {});
	}

	toggle(): void {
		if (this.on) {
			live.config = null;
			return;
		}
		const user = cloudSession.user;
		const remoteId = this.#document().remoteId;
		if (!user || !remoteId) return;
		const base = SERVER_URL.replace(/^http/, "ws");
		live.config = {
			url: (path) =>
				`${base}/api/projects/${encodeURIComponent(remoteId)}/files/live?path=${encodeURIComponent(path)}`,
			person: { name: user.name || user.email, color: colorOf(user.id) },
			idleSeconds: this.limits?.idleSeconds
		};
	}

	/** Why the server ended or refused the session, in words, or undefined while all is well. */
	endReason(): string | undefined {
		const limits = this.limits;
		switch (live.status) {
			case "unavailable":
				return "Live editing is not available right now: this server does not host it or has reached its daily platform limit. Edits still sync normally.";
			case "full":
				return `This file already has the maximum of ${limits?.maxEditors ?? "the allowed number of"} people editing live. Try again when someone leaves; edits still sync normally.`;
			case "idle":
				return `Live editing paused after ${limits ? minutes(limits.idleSeconds) : "a few"} minutes without typing, to free the room. Turn live editing on to rejoin.`;
			case "session":
				return `The live session reached its ${limits ? hours(limits.maxSessionSeconds) : "time"} hour limit. Turn live editing on to start a new one.`;
			default:
				return undefined;
		}
	}
}
