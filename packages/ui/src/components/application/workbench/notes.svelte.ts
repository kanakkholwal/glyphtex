import { safeStorage } from "@glyphtex/ui/persisted-state";

/** A checklist item pinned to one document. */
export type Note = {
	id: string;
	text: string;
	done: boolean;
	tags: string[];
	at: number;
};

export type NoteFilter = "all" | "open" | "done";

const TAG = /#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;
const storageKey = (scope: string) => `glyphtex:notes:${scope}`;

/** `#tag` tokens anywhere in the text become chips. */
export function extractTags(text: string): string[] {
	return [...new Set(Array.from(text.matchAll(TAG), (m) => m[1].toLowerCase()))];
}
export function stripTags(text: string): string {
	return text
		.replace(TAG, "")
		.replace(/\s{2,}/g, " ")
		.trim();
}

/** Coarse relative time: notes only ever need "when, roughly". */
export function relativeTime(at: number, now = Date.now()): string {
	const s = Math.max(0, Math.round((now - at) / 1000));
	if (s < 45) return "Just now";
	const m = Math.round(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.round(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.round(h / 24);
	return d < 7 ? `${d}d ago` : `${Math.round(d / 7)}w ago`;
}

/**
 * Per-document notes, persisted to local storage under the document's scope key.
 * Nothing leaves the device: same guarantee as the rest of the workbench.
 */
export class NotesStore {
	readonly #getScope: () => string;

	notes = $state<Note[]>([]);
	draft = $state("");
	filter = $state<NoteFilter>("all");

	// Plain field: comparing against it inside `sync` must not make the effect
	// re-run when it changes.
	#scope = "";

	constructor(getScope: () => string) {
		this.#getScope = getScope;
	}

	/** Load the open document's notes; re-runs when the document changes. Call from a `$effect`. */
	sync(): void {
		const scope = this.#getScope();
		if (!scope || scope === this.#scope) return;
		this.#scope = scope;
		this.notes = safeStorage
			.get<Note[]>(storageKey(scope), [])
			.filter((n): n is Note => Boolean(n && typeof n.text === "string"));
	}

	#persist(): void {
		if (this.#scope) safeStorage.set(storageKey(this.#scope), this.notes);
	}

	readonly openCount = $derived(this.notes.filter((n) => !n.done).length);
	readonly doneCount = $derived(this.notes.length - this.openCount);
	readonly visible = $derived(
		this.filter === "all"
			? this.notes
			: this.notes.filter((n) => (this.filter === "done" ? n.done : !n.done))
	);

	add(): void {
		const text = this.draft.trim();
		if (!text) return;
		this.notes = [
			{
				id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
				text,
				done: false,
				tags: extractTags(text),
				at: Date.now()
			},
			...this.notes
		];
		this.draft = "";
		this.#persist();
	}

	toggle(id: string): void {
		this.notes = this.notes.map((n) => (n.id === id ? { ...n, done: !n.done, at: Date.now() } : n));
		this.#persist();
	}

	edit(id: string, text: string): void {
		const next = text.trim();
		if (!next) {
			this.remove(id);
			return;
		}
		this.notes = this.notes.map((n) =>
			n.id === id ? { ...n, text: next, tags: extractTags(next), at: Date.now() } : n
		);
		this.#persist();
	}

	remove(id: string): void {
		this.notes = this.notes.filter((n) => n.id !== id);
		this.#persist();
	}

	clearDone(): void {
		this.notes = this.notes.filter((n) => !n.done);
		this.#persist();
	}
}
