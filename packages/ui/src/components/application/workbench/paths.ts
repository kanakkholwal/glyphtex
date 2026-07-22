// --- Absolute paths (separator inferred from the value) ---------------------
export function sepOf(p: string): string {
  return p.includes("\\") ? "\\" : "/";
}
export function baseName(p: string): string {
  const s = p.replace(/[\\/]+$/, "");
  const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
  return i >= 0 ? s.slice(i + 1) : s;
}
export function parentDir(p: string): string {
  const s = p.replace(/[\\/]+$/, "");
  const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
  return i >= 0 ? s.slice(0, i) : s;
}
export function joinPath(root: string, rel: string): string {
  const sep = sepOf(root);
  return root.replace(/[\\/]+$/, "") + sep + rel.split("/").join(sep);
}
export function samePath(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const n = (s: string) => s.replace(/[\\/]+/g, "/").toLowerCase();
  return n(a) === n(b);
}

// --- Relative tree paths (always forward-slash) -----------------------------
export function leafOf(rel: string): string {
  const i = rel.lastIndexOf("/");
  return i === -1 ? rel : rel.slice(i + 1);
}
export function dirOf(rel: string): string {
  const i = rel.lastIndexOf("/");
  return i === -1 ? "" : rel.slice(0, i);
}
export function splitExt(name: string): { base: string; ext: string } {
  const i = name.lastIndexOf(".");
  return i > 0
    ? { base: name.slice(0, i), ext: name.slice(i) }
    : { base: name, ext: "" };
}
