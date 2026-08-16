import { isGeneratedFile } from "../file-kinds";
import type { TreeNode } from "../file-tree.svelte";
import type { Sel } from "./types";

type FileMeta = { id: string; name: string };

/** A row key back to the selection it stands for. */
export function rowKeyToSel(key: string): Sel {
	return key.startsWith("d:")
		? { type: "folder", path: key.slice(2) }
		: { type: "file", id: key.slice(2) };
}

/** Nests file names split on "/" into folders. `extraFolders` injects folders with no
 *  files yet, so a freshly-created empty folder still appears. */
export function buildTree(items: FileMeta[], extraFolders: string[] = []): TreeNode[] {
	const root: TreeNode[] = [];
	const folderChildren = new Map<string, TreeNode[]>();

	function ensureFolder(path: string): TreeNode[] {
		let level = root;
		let cur = "";
		for (const part of path.split("/")) {
			if (!part) continue;
			cur = cur ? `${cur}/${part}` : part;
			let children = folderChildren.get(cur);
			if (!children) {
				children = [];
				folderChildren.set(cur, children);
				level.push({ type: "folder", name: part, path: cur, children });
			}
			level = children;
		}
		return level;
	}

	for (const f of items) {
		const parts = f.name.split("/");
		const leaf = parts.pop() ?? f.name;
		const level = parts.length ? ensureFolder(parts.join("/")) : root;
		level.push({ type: "file", id: f.id, name: leaf });
	}
	for (const p of extraFolders) if (p) ensureFolder(p);

	function sort(nodes: TreeNode[]) {
		nodes.sort((a, b) =>
			a.type !== b.type
				? a.type === "folder"
					? -1
					: 1
				: a.name.localeCompare(b.name, undefined, { numeric: true })
		);
		for (const n of nodes) if (n.type === "folder") sort(n.children);
	}
	sort(root);
	return root;
}

/** Flatten the tree to every folder path (depth-first). */
export function collectFolderPaths(nodes: TreeNode[], acc: string[] = []): string[] {
	for (const n of nodes)
		if (n.type === "folder") {
			acc.push(n.path);
			collectFolderPaths(n.children, acc);
		}
	return acc;
}

/** One rendered row. The view is a flat list so roving focus, arrow keys and
 *  type-ahead are plain array maths instead of a walk through nested components. */
export type TreeRow = {
	node: TreeNode;
	depth: number;
	/** `d:<path>` for folders, `f:<id>` for files. */
	key: string;
	expanded: boolean;
	/** Folder a drop on this row targets ('' = project root). */
	dropDir: string;
	/** File: unsaved. Folder: something beneath it is. */
	dirty: boolean;
};

/**
 * Visible rows, in display order. Folder dirt is accumulated on the way back up,
 * so each node is visited once rather than re-walking its subtree per row.
 */
export function flattenTree(
	nodes: TreeNode[],
	isOpen: (path: string) => boolean,
	dirtyIds: Set<string>
): TreeRow[] {
	const rows: TreeRow[] = [];

	function walk(list: TreeNode[], depth: number, parent: string): boolean {
		let dirty = false;
		for (const node of list) {
			if (node.type === "file") {
				const own = dirtyIds.has(node.id);
				dirty ||= own;
				rows.push({
					node,
					depth,
					key: `f:${node.id}`,
					expanded: false,
					dropDir: parent,
					dirty: own
				});
				continue;
			}
			const expanded = isOpen(node.path);
			const row: TreeRow = {
				node,
				depth,
				key: `d:${node.path}`,
				expanded,
				dropDir: node.path,
				dirty: false
			};
			rows.push(row);
			// A collapsed folder still has to report its subtree's dirt, so descend
			// either way and discard the rows it produced when it is closed.
			const mark = rows.length;
			row.dirty = walk(node.children, depth + 1, node.path);
			if (!expanded) rows.length = mark;
			dirty ||= row.dirty;
		}
		return dirty;
	}

	walk(nodes, 0, "");
	return rows;
}

/** Drop compiler output, keeping folders that still hold something. The active
 *  file is always kept: hiding the row for what is on screen reads as a bug. */
export function hideGenerated(nodes: TreeNode[], activeId: string): TreeNode[] {
	const keep = (list: TreeNode[]): TreeNode[] => {
		const out: TreeNode[] = [];
		for (const node of list) {
			if (node.type === "file") {
				if (node.id === activeId || !isGeneratedFile(node.name)) out.push(node);
				continue;
			}
			const children = keep(node.children);
			// An empty folder stays: it was empty before, and losing it mid-compile
			// would make the tree jump.
			if (children.length || !node.children.length) out.push({ ...node, children });
		}
		return out;
	};
	return keep(nodes);
}

/** Keep only what matches `query`, plus the folders on the way to each hit. */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return nodes;
	const keep = (list: TreeNode[]): TreeNode[] => {
		const out: TreeNode[] = [];
		for (const node of list) {
			if (node.type === "file") {
				if (node.name.toLowerCase().includes(needle)) out.push(node);
				continue;
			}
			const children = keep(node.children);
			// A folder whose own name matches keeps its whole subtree: you searched
			// for the folder, not for something inside it.
			if (node.name.toLowerCase().includes(needle)) out.push(node);
			else if (children.length) out.push({ ...node, children });
		}
		return out;
	};
	return keep(nodes);
}
