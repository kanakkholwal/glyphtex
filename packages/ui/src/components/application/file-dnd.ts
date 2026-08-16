// A plain singleton, not a rune: the dragged items must be readable during
// `dragover`/`drop`, where the native DataTransfer is blocked for security.
export type DndItem =
	| { kind: "file"; id: string; name: string }
	| { kind: "folder"; path: string; name: string };

let current: DndItem[] = [];

export function setDrag(items: DndItem[] | DndItem | null): void {
	current = !items ? [] : Array.isArray(items) ? items : [items];
}
export function getDrag(): DndItem[] {
	return current;
}

/** Forward-slash parent dir of a dragged item ('' = root). */
export function dndParent(item: DndItem): string {
	const s = item.kind === "folder" ? item.path : item.name;
	const i = s.lastIndexOf("/");
	return i === -1 ? "" : s.slice(0, i);
}

/** Whether one item may land in `targetDir`. Rejects a folder into itself or a
 *  descendant, and anything into the folder it already lives in (a no-op). */
export function canDropItem(item: DndItem, targetDir: string): boolean {
	if (item.kind === "folder") {
		if (targetDir === item.path) return false;
		if (targetDir.startsWith(item.path + "/")) return false;
	}
	return dndParent(item) !== targetDir;
}

/** Whether the drag may drop into `targetDir` ('' = root). True when *any* item
 *  can move: a mixed selection still has work to do, and the no-ops are skipped. */
export function canDropInto(targetDir: string): boolean {
	return current.some((item) => canDropItem(item, targetDir));
}

/** The items a drop on `targetDir` should actually move. */
export function droppable(targetDir: string): DndItem[] {
	return current.filter((item) => canDropItem(item, targetDir));
}
