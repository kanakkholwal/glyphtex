import type { CompileFile } from './protocol';

/** The slice of the engine that mounting touches. */
export interface MountTarget {
	addFile(name: string, data: Uint8Array | string): void;
	removeFile(name: string): boolean;
	clearOutputs(): void;
}

/** Which document's files are currently in the engine's filesystem. */
export interface MountState {
	doc: string | null;
	files: Set<string>;
}

export function emptyMount(): MountState {
	return { doc: null, files: new Set() };
}

/**
 * Whether unmounting the current document would also delete bundle files it
 * shadowed. The flat VFS has one entry per name, so a project's `article.cls`
 * replaced the bundle's; removing it leaves nothing behind. The caller rebuilds
 * the engine instead.
 */
export function shadowsBundle(
	state: MountState,
	bundleNames: ReadonlySet<string>,
	docId: string
): boolean {
	if (state.doc === docId) return false;
	for (const name of state.files) if (bundleNames.has(name)) return true;
	return false;
}

/**
 * Make the engine's filesystem match `files` exactly, and return the new state.
 *
 * Switching documents also drops the previous one's outputs: two documents
 * commonly share the `main.tex` entry, so a kept `.aux` would resurface as this
 * document's undefined citations and multiply-defined labels. Within one
 * document the outputs stay, which is what lets a recompile converge early.
 */
export function mountDocument(
	engine: MountTarget,
	state: MountState,
	docId: string,
	files: readonly CompileFile[]
): MountState {
	const incoming = new Set(files.map((f) => f.name));
	const switching = state.doc !== docId;

	for (const name of state.files) {
		if (switching || !incoming.has(name)) engine.removeFile(name);
	}
	if (switching) engine.clearOutputs();

	for (const file of files) engine.addFile(file.name, file.data ?? file.text ?? '');

	return { doc: docId, files: incoming };
}
