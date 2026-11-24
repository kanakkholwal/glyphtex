import { batch, createAtom, type ReadonlyAtom } from "@tanstack/store";
import type { TableReactivityBindings } from "@tanstack/table-core/reactivity";
import { untrack } from "svelte";

/** A getter that reads the atom and also registers the current rune scope on it. */
function tracked<T>(atom: ReadonlyAtom<T>): () => T {
	let version = $state(0);
	$effect(() => {
		const subscription = atom.subscribe(() => {
			version += 1;
		});
		return () => subscription.unsubscribe();
	});
	const value = $derived.by(() => {
		void version;
		return atom.get();
	});
	return () => {
		// The store read keeps atom-to-atom tracking; touching `value` registers the rune scope.
		const current = atom.get();
		void value;
		return current;
	};
}

/**
 * table-core's reactivity on runes, so reads like `row.getIsSelected()` track in templates.
 * Build the table during component init: each readonly atom bridges through an `$effect`.
 */
export function svelteReactivity(): TableReactivityBindings {
	return {
		createOptionsStore: true,
		wrapExternalAtoms: false,
		addSubscription: () => {
			throw new Error("DataTable: external atom subscriptions are not supported");
		},
		schedule: (fn) => queueMicrotask(fn),
		untrack,
		batch,
		createWritableAtom: (initial, options) => {
			const atom = createAtom(initial, { compare: options?.compare });
			// Row models read options directly, so only the options store needs to track.
			if (options?.debugName !== "table/optionsStore") return atom;
			return { get: tracked(atom), set: atom.set, subscribe: atom.subscribe };
		},
		createReadonlyAtom: (fn, options) => {
			const atom = createAtom(() => fn(), { compare: options?.compare });
			return { get: tracked(atom), subscribe: atom.subscribe };
		}
	};
}
