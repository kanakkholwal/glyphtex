/**
 * Pure find/replace helpers for the editor: compile a `SearchOptions` into a
 * global RegExp, and expand `$&` / `$1`… back-references in a replacement.
 */
import type { SearchOptions } from "./types";

export function buildRegex(o: SearchOptions): RegExp | null {
  if (!o.query) return null;
  let pat = o.regexp
    ? o.query
    : o.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (o.wholeWord) pat = `\\b(?:${pat})\\b`;
  try {
    return new RegExp(pat, "g" + (o.caseSensitive ? "" : "i"));
  } catch {
    return null; // invalid regex — caller shows no results
  }
}

/** Expand `$&` / `$1`… in a replacement string against a regex match. */
export function expandReplacement(
  replacement: string,
  match: string,
  groups: (string | undefined)[],
): string {
  return replacement.replace(/\$(\$|&|\d{1,2})/g, (_, token: string) => {
    if (token === "$") return "$";
    if (token === "&") return match;
    return groups[parseInt(token, 10) - 1] ?? "";
  });
}
