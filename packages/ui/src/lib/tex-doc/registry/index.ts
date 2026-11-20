import type { MarkKind } from "../types";
import { amsmath, mathExtras } from "./packages/amsmath";
import { biblatex, cleveref, crossRefs, natbib } from "./packages/citations";
import { core } from "./packages/core";
import { amsthm, structure } from "./packages/structure";
import { csquotes, floatExtras, listings, paralist, soul, ulem } from "./packages/text";
import type { ContainerSpec, PackageSpec } from "./types";

// Decision (architecture): every package is plain data in ./packages, folded here into frozen
// lookup tables. Adding a command is one line in one file; the parser never changes.
const SPECS: readonly PackageSpec[] = [
	core,
	amsmath,
	mathExtras,
	natbib,
	biblatex,
	cleveref,
	crossRefs,
	ulem,
	soul,
	paralist,
	listings,
	floatExtras,
	csquotes,
	structure,
	amsthm
];

type ListShape = { ordered: boolean; description: boolean };

const marks = new Map<string, MarkKind>();
const cites = new Set<string>();
const refs = new Set<string>();
const lists = new Map<string, ListShape>();
const math = new Set<string>();
const code = new Set<string>();
const floats = new Set<string>();
const quotes = new Set<string>();
const containers = new Map<string, ContainerSpec>();

for (const spec of SPECS) {
	for (const [name, mark] of Object.entries(spec.marks ?? {})) marks.set(name, mark);
	for (const name of spec.cites ?? []) cites.add(name);
	for (const name of spec.refs ?? []) refs.add(name);
	for (const [name, shape] of Object.entries(spec.lists ?? {}))
		lists.set(name, { ordered: shape.ordered ?? false, description: shape.description ?? false });
	for (const name of spec.math ?? []) math.add(name);
	for (const name of spec.code ?? []) code.add(name);
	for (const name of spec.floats ?? []) floats.add(name);
	for (const name of spec.quotes ?? []) quotes.add(name);
	for (const [name, shape] of Object.entries(spec.containers ?? {})) containers.set(name, shape);
}

export const markOf = (name: string): MarkKind | undefined => marks.get(name);
export const isCite = (name: string): boolean => cites.has(name);
export const isRef = (name: string): boolean => refs.has(name);
export const listShape = (env: string): ListShape | undefined => lists.get(env);
export const isMathEnv = (env: string): boolean => math.has(env);
export const isCodeEnv = (env: string): boolean => code.has(env);
export const isFloatEnv = (env: string): boolean => floats.has(env);
export const containerOf = (env: string): ContainerSpec | undefined => containers.get(env);
export const isQuoteEnv = (env: string): boolean => quotes.has(env);

/** Every entry the registry knows, for the coverage count and future menus. */
export const REGISTRY_SIZE =
	marks.size +
	cites.size +
	refs.size +
	lists.size +
	math.size +
	code.size +
	floats.size +
	quotes.size +
	containers.size;

const provided = new Map<string, string[]>();
for (const spec of SPECS) {
	if (!spec.package) continue;
	const names = [
		...Object.keys(spec.marks ?? {}),
		...(spec.cites ?? []),
		...(spec.refs ?? []),
		...Object.keys(spec.lists ?? {}),
		...(spec.math ?? []),
		...(spec.code ?? []),
		...(spec.floats ?? []),
		...(spec.quotes ?? []),
		...Object.keys(spec.containers ?? {})
	];
	provided.set(spec.package, [...(provided.get(spec.package) ?? []), ...names]);
}

/** What the visual editor draws because of a package, for the setup panel. */
export const providedBy = (pkg: string): readonly string[] => provided.get(pkg) ?? [];

/** Packages the visual editor has something to say about, for "Add package". */
export const KNOWN_PACKAGES: readonly string[] = [...provided.keys()].sort();
