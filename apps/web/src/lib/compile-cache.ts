import type { CompileFile } from "./tex/protocol";

// FNV-1a, 32-bit. A cheap content fingerprint: hashing an image's bytes on every
// keystroke would cost more than it saves, but this loop is a few ms on a few MB
// and near-zero on a text-only edit.
function fnv1a(seed: number, bytes: Uint8Array): number {
	let h = seed >>> 0;
	for (let i = 0; i < bytes.length; i++) {
		h ^= bytes[i];
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

const encoder = new TextEncoder();

/**
 * A signature over exactly what the worker would compile: the entry name and,
 * per file, its name and content. Identical signature means identical bytes in,
 * which for a deterministic engine means identical output — so it can be served
 * from cache instead of spending a compile. Order-independent: files are sorted.
 */
export function signature(files: readonly CompileFile[], entry: string): string {
	let h = fnv1a(0x811c9dc5, encoder.encode(entry));
	for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
		h = fnv1a(h, encoder.encode(`\0${f.name}\0`));
		h = fnv1a(h, f.data ?? encoder.encode(f.text ?? ""));
	}
	return `${files.length}:${h.toString(16)}`;
}

/**
 * Last clean build per document, keyed by docId. Bounded so a session that
 * opens many documents cannot grow it without limit; the oldest is evicted.
 */
export class CompileCache<T> {
	readonly #map = new Map<string, { sig: string; value: T }>();
	readonly #max: number;

	constructor(max = 4) {
		this.#max = max;
	}

	get(docId: string, sig: string): T | undefined {
		const hit = this.#map.get(docId);
		return hit?.sig === sig ? hit.value : undefined;
	}

	set(docId: string, sig: string, value: T): void {
		// Re-insert last so eviction order tracks recency, not first-seen.
		this.#map.delete(docId);
		this.#map.set(docId, { sig, value });
		for (const key of this.#map.keys()) {
			if (this.#map.size <= this.#max) break;
			this.#map.delete(key);
		}
	}

	clear(): void {
		this.#map.clear();
	}
}
