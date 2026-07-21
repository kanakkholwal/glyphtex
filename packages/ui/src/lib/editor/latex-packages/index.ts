import type { LatexCommand, LatexEnvironment } from "../latex-data";

export type PackageData = {
	commands: readonly LatexCommand[];
	environments: readonly LatexEnvironment[];
};

/** Package name → loader. Vite code-splits each dynamic import into its own chunk. */
export const PACKAGE_LOADERS: Readonly<Record<string, () => Promise<PackageData>>> = {
	tikz: () => import("./tikz").then((m) => m.data),
	pgfplots: () => import("./pgfplots").then((m) => m.data),
	biblatex: () => import("./biblatex").then((m) => m.data),
	natbib: () => import("./natbib").then((m) => m.data),
	siunitx: () => import("./siunitx").then((m) => m.data),
	beamer: () => import("./beamer").then((m) => m.data),
	listings: () => import("./listings").then((m) => m.data),
	minted: () => import("./minted").then((m) => m.data),
	hyperref: () => import("./hyperref").then((m) => m.data),
	cleveref: () => import("./cleveref").then((m) => m.data),
	booktabs: () => import("./booktabs").then((m) => m.data),
	enumitem: () => import("./enumitem").then((m) => m.data),
	geometry: () => import("./geometry").then((m) => m.data),
	xcolor: () => import("./xcolor").then((m) => m.data),
	graphicx: () => import("./graphicx").then((m) => m.data),
	algorithm2e: () => import("./algorithm2e").then((m) => m.data),
	amsthm: () => import("./amsthm").then((m) => m.data),
	mathtools: () => import("./mathtools").then((m) => m.data),
	subcaption: () => import("./subcaption").then((m) => m.data),
	todonotes: () => import("./todonotes").then((m) => m.data),
};

/** Packages we have data for, for the `\usepackage{}` suggestion detail. */
export const KNOWN_PACKAGES: readonly string[] = Object.keys(PACKAGE_LOADERS);

const loaded = new Map<string, PackageData>();
const loading = new Map<string, Promise<PackageData | null>>();

/**
 * Ensure data for `names` is loaded. Unknown packages resolve to nothing rather
 * than throwing, because a document may legitimately load anything.
 */
export function ensurePackages(names: Iterable<string>): Promise<void> {
	const pending: Promise<unknown>[] = [];

	for (const name of names) {
		if (loaded.has(name)) continue;

		const existing = loading.get(name);
		if (existing) {
			pending.push(existing);
			continue;
		}

		const loader = PACKAGE_LOADERS[name];
		if (!loader) continue;

		const promise = loader()
			.then((data) => {
				loaded.set(name, data);
				return data;
			})
			.catch(() => {
				// Drop the in-flight entry so a later edit retries the failed chunk.
				loading.delete(name);
				return null;
			});

		loading.set(name, promise);
		pending.push(promise);
	}

	return Promise.all(pending).then(() => undefined);
}

/** Commands and environments from every package loaded so far. */
export function loadedPackageData(): PackageData {
	const commands: LatexCommand[] = [];
	const environments: LatexEnvironment[] = [];
	for (const data of loaded.values()) {
		commands.push(...data.commands);
		environments.push(...data.environments);
	}
	return { commands, environments };
}
