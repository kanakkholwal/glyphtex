// A plain singleton, not a rune: the dragged item must be readable during
// `dragover`/`drop`, where the native DataTransfer is blocked for security.
export type DndItem =
	| { kind: 'file'; id: string; name: string }
	| { kind: 'folder'; path: string; name: string };

let current: DndItem | null = null;

export function setDrag(item: DndItem | null): void {
	current = item;
}
export function getDrag(): DndItem | null {
	return current;
}

/** Forward-slash parent dir of the dragged item ('' = root). */
export function dndParent(item: DndItem): string {
	const s = item.kind === 'folder' ? item.path : item.name;
	const i = s.lastIndexOf('/');
	return i === -1 ? '' : s.slice(0, i);
}

/**
 * Whether the current drag may drop into `targetDir` ('' = root). Rejects:
 * dropping a folder into itself or a descendant, and dropping anything into the
 * folder it already lives in (a no-op).
 */
export function canDropInto(targetDir: string): boolean {
	const it = current;
	if (!it) return false;
	if (it.kind === 'folder') {
		if (targetDir === it.path) return false;
		if (targetDir.startsWith(it.path + '/')) return false;
	}
	if (dndParent(it) === targetDir) return false;
	return true;
}
