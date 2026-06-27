/**
 * Pure helpers for the Source Control changes view: build a nested folder tree
 * from a flat change list (VS Code-style), plus small formatting utilities.
 */
import type { GitChange, TreeNode } from "./types";

export function buildTree(items: GitChange[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isFile: false, children: [] };
  for (const c of items) {
    const parts = c.path.split("/");
    let node = root;
    let acc = "";
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isFile = i === parts.length - 1;
      let child = node.children.find(
        (n) => n.name === part && n.isFile === isFile,
      );
      if (!child) {
        child = {
          name: part,
          path: isFile ? c.path : acc,
          isFile,
          change: isFile ? c : undefined,
          children: [],
        };
        node.children.push(child);
      }
      node = child;
    });
  }
  // Nest level-by-level like the Explorer (no folder compression).
  return sortNodes(root.children);
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  nodes.sort((a, b) =>
    a.isFile !== b.isFile
      ? a.isFile
        ? 1
        : -1
      : a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  for (const n of nodes) if (!n.isFile) sortNodes(n.children);
  return nodes;
}

/** Indentation matching the Explorer tree. */
export const indent = (d: number) => `${d * 12 + 8}px`;
/** Last path segment (the file name without its directory). */
export const leaf = (p: string) => p.split("/").pop() ?? p;

/** Short, locale-aware commit date (e.g. "Jun 27"). */
export function whenLabel(secs: number): string {
  return new Date(secs * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
