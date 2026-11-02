// Plain TS with no aliases: `scripts/og.mjs` imports this file directly under Node.

type Named = { name: string };
type Provided = { name: string; package?: string };

export type PackageCoverage = { commands: number; environments: number; templates: number };

/** A package earns its own page only with real material, so the reference never ships thin pages. */
export const hasPackagePage = (c: PackageCoverage): boolean =>
	c.commands + c.environments >= 2 || c.templates >= 2;

/** Commands, environments and templates per package, for every package in the completion data. */
export function packageCoverage(
	packages: readonly Named[],
	commands: readonly Provided[],
	environments: readonly Provided[],
	templateUses: readonly (readonly string[])[]
): Map<string, PackageCoverage> {
	const out = new Map<string, PackageCoverage>();
	for (const p of packages) out.set(p.name, { commands: 0, environments: 0, templates: 0 });
	// The completion data can list one command per context, so count each name once.
	const seen = new Set<string>();
	const once = (kind: string, item: Provided) => {
		const key = `${kind}:${item.package}:${item.name}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	};
	for (const c of commands) if (c.package && once("c", c)) bump(out, c.package, "commands");
	for (const e of environments) {
		if (e.package && once("e", e)) bump(out, e.package, "environments");
	}
	for (const uses of templateUses) for (const name of uses) bump(out, name, "templates");
	return out;
}

function bump(map: Map<string, PackageCoverage>, name: string, key: keyof PackageCoverage) {
	const entry = map.get(name);
	if (entry) entry[key]++;
}

/** `frac{$1}{$2}$0` becomes `\frac{…}{…}`: a readable usage line from an editor snippet. */
export function syntaxOf(name: string, snippet?: string): string {
	if (!snippet) return `\\${name}`;
	const body = snippet
		.replace(/\$\{\d+:([^}]*)\}/g, "$1")
		.replace(/\$\d+/g, "…")
		.replace(/…$/, "");
	return `\\${body}`;
}
