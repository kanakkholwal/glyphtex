/**
 * Pure helpers for the Explorer tree: build a nested folder tree from a flat
 * file list (folders sort before files, alphabetically) and walk it to collect
 * folder paths. No Svelte / runes.
 */
import type { TreeNode } from "../file-tree.svelte";

type FileMeta = { id: string; name: string };

/**
 * Folder-based project tree — file names split on "/" nest into folders.
 * `extraFolders` injects folders that have no files yet (freshly created), so an
 * empty folder still appears. Root files live at the root (VS Code style); only
 * real subfolders nest.
 */
export function buildTree(
  items: FileMeta[],
  extraFolders: string[] = [],
): TreeNode[] {
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
        : a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
    for (const n of nodes) if (n.type === "folder") sort(n.children);
  }
  sort(root);
  return root;
}

/** Flatten the tree to every folder path (depth-first). */
export function collectFolderPaths(
  nodes: TreeNode[],
  acc: string[] = [],
): string[] {
  for (const n of nodes)
    if (n.type === "folder") {
      acc.push(n.path);
      collectFolderPaths(n.children, acc);
    }
  return acc;
}
