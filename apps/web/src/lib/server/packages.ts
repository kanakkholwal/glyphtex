import {
	hasPackagePage,
	type PackageCoverage,
	packageCoverage,
	syntaxOf
} from "$lib/packages/coverage";
import { LATEX_COMMANDS, LATEX_ENVIRONMENTS, LATEX_PACKAGES } from "@glyphtex/ui/editor";
import type { ProjectTemplate } from "@glyphtex/ui/project-templates";
import { templatePackageUses } from "./templates";

export type PackageSummary = {
	name: string;
	detail: string;
	coverage: PackageCoverage;
	hasPage: boolean;
};

export type PackageEntry = { name: string; syntax: string; detail: string; context?: string };

export type PackageDetail = PackageSummary & {
	commands: PackageEntry[];
	environments: PackageEntry[];
	templates: ProjectTemplate[];
};

export async function listPackages(): Promise<PackageSummary[]> {
	const uses = await templatePackageUses();
	const coverage = packageCoverage(
		LATEX_PACKAGES,
		LATEX_COMMANDS,
		LATEX_ENVIRONMENTS,
		uses.map((u) => u.packages)
	);
	return LATEX_PACKAGES.map((p) => {
		const c = coverage.get(p.name) ?? { commands: 0, environments: 0, templates: 0 };
		const detail = p.detail.replace(/\.$/, "");
		return { name: p.name, detail, coverage: c, hasPage: hasPackagePage(c) };
	}).sort((a, b) => a.name.localeCompare(b.name));
}

/** The completion data can list a command once per context; one row per name is enough here. */
const uniqueByName = <T extends { name: string }>(items: T[]): T[] =>
	items.filter((item, i) => items.findIndex((other) => other.name === item.name) === i);

export async function packageDetail(name: string): Promise<PackageDetail | null> {
	const summary = (await listPackages()).find((p) => p.name === name && p.hasPage);
	if (!summary) return null;
	const uses = await templatePackageUses();
	// Originals first: those are the template pages that are indexed.
	const templates = uses
		.filter((u) => u.packages.includes(name))
		.map((u) => u.template)
		.sort((a, b) => Number(b.origin === "glyphtex") - Number(a.origin === "glyphtex"));
	return {
		...summary,
		commands: uniqueByName(
			LATEX_COMMANDS.filter((c) => c.package === name).map((c) => ({
				name: c.name,
				syntax: syntaxOf(c.name, c.snippet),
				detail: c.detail,
				context: c.context
			}))
		),
		environments: uniqueByName(
			LATEX_ENVIRONMENTS.filter((e) => e.package === name).map((e) => ({
				name: e.name,
				syntax: `\\begin{${e.name}}`,
				detail: e.detail,
				context: e.context
			}))
		),
		templates
	};
}

/** Names that have their own page, for prerender entries and template-page links. */
export async function packagePageNames(): Promise<Set<string>> {
	return new Set((await listPackages()).filter((p) => p.hasPage).map((p) => p.name));
}
