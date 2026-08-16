import { safeStorage } from '@glyphtex/ui/persisted-state';

const storageKey = (scope: string) => `glyphtex:tree:${scope}`;

/**
 * Which Explorer folders are expanded, plus the Explorer's selection.
 *
 * A module singleton like the drag payload: the FileStore has to rewrite these
 * paths when a folder is renamed, moved or deleted, and it shares no other
 * channel with the side panel's store.
 */
class TreeState {
	#scope = '';
	open = $state<Record<string, boolean>>({});

	/** Selected rows as `TreeRow` keys, in the order they were picked. */
	selectedKeys = $state<string[]>([]);
	/** Where a shift-click measures its range from. */
	anchor = $state<string | null>(null);

	/** Top-level folders start open, deeper ones closed: enough to show a project's
	 *  shape without unrolling a whole thesis on first paint. */
	isOpen(path: string): boolean {
		return this.open[path] ?? !path.includes('/');
	}
	set(path: string, value: boolean): void {
		this.open = { ...this.open, [path]: value };
		this.#persist();
	}
	toggle(path: string): void {
		this.set(path, !this.isOpen(path));
	}
	setMany(paths: string[], value: boolean): void {
		if (!paths.length) return;
		const next = { ...this.open };
		for (const path of paths) next[path] = value;
		this.open = next;
		this.#persist();
	}

	/** Expand every folder on the way to `rel`, so a reveal cannot land on a row
	 *  that is still hidden. Does not touch `rel` itself. */
	revealPath(rel: string): void {
		const parts = rel.split('/');
		parts.pop();
		const dirs: string[] = [];
		let cur = '';
		for (const part of parts) {
			cur = cur ? `${cur}/${part}` : part;
			dirs.push(cur);
		}
		this.setMany(
			dirs.filter((d) => !this.isOpen(d)),
			true
		);
	}

	/** Follow a folder rename or move, subtree included. */
	remap(oldPath: string, newPath: string): void {
		if (oldPath === newPath) return;
		const prefix = `${oldPath}/`;
		const next: Record<string, boolean> = {};
		for (const [path, value] of Object.entries(this.open)) {
			if (path === oldPath) next[newPath] = value;
			else if (path.startsWith(prefix)) next[newPath + path.slice(oldPath.length)] = value;
			else next[path] = value;
		}
		this.open = next;
		this.selectedKeys = this.selectedKeys.map((key) => {
			if (key === `d:${oldPath}`) return `d:${newPath}`;
			return key.startsWith(`d:${prefix}`) ? `d:${newPath}${key.slice(2 + oldPath.length)}` : key;
		});
		this.#persist();
	}

	/** Forget a folder and its subtree. */
	drop(path: string): void {
		const prefix = `${path}/`;
		const next: Record<string, boolean> = {};
		for (const [p, value] of Object.entries(this.open))
			if (p !== path && !p.startsWith(prefix)) next[p] = value;
		this.open = next;
		this.selectedKeys = this.selectedKeys.filter(
			(key) => key !== `d:${path}` && !key.startsWith(`d:${prefix}`)
		);
		this.#persist();
	}

	/** Point at another document's saved tree. Selection is per-session, not stored:
	 *  it drives destructive actions, and reviving one across a reload is a trap. */
	load(scope: string): void {
		this.#scope = scope;
		const saved = scope
			? safeStorage.get<Record<string, boolean> | null>(storageKey(scope), null)
			: null;
		this.open = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
		this.selectedKeys = [];
		this.anchor = null;
	}

	#persist(): void {
		if (this.#scope) safeStorage.set(storageKey(this.#scope), this.open);
	}
}

export const treeState = new TreeState();
