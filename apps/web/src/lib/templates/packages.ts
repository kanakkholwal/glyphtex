// Plain TS with no aliases: `scripts/og.mjs` imports this file directly under Node.

/** Package names from `\usepackage` and `\RequirePackage`, in load order, without duplicates. */
export function packagesIn(source: string): string[] {
	const names = new Set<string>();
	const uncommented = source.replace(/(^|[^\\])%.*$/gm, "$1");
	for (const m of uncommented.matchAll(
		/\\(?:usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g
	)) {
		for (const name of m[1].split(",")) {
			const clean = name.trim();
			if (/^[A-Za-z0-9-]+$/.test(clean)) names.add(clean);
		}
	}
	return [...names];
}
