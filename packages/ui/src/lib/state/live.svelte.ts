import type { LivePerson, LiveStatus } from "../editor/live";

export interface LiveConfig {
	/** WebSocket URL for one file of the open project, or null when it can't be live. */
	url(path: string): string | null;
	person: LivePerson;
}

/** Shared switch for live co-editing: the host app sets `config`, the editor reads it. */
class LiveEditing {
	config = $state<LiveConfig | null>(null);
	status = $state<LiveStatus | "off">("off");
}

export const live = new LiveEditing();
