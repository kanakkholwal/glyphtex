import type { ContainerRole, MarkKind } from "../types";

export type ContainerSpec = { role: ContainerRole; label: string; numbered?: boolean };

/**
 * What one LaTeX package (or the core) teaches the visual editor. Plain data: the engine in
 * `index.ts` compiles every spec into frozen lookup tables, so a command costs one `Map.get`.
 * Anything not listed stays a raw chip and round-trips untouched.
 */
export type PackageSpec = {
	/** The `\usepackage` name; empty for core LaTeX. Kept for per-document gating and the insert hint. */
	package: string;
	/** `\cmd{text}` rendered as a styled run. */
	marks?: Record<string, MarkKind>;
	/** `\cmd{key,key}`: citations. */
	cites?: readonly string[];
	/** `\cmd{label}`: cross-references. */
	refs?: readonly string[];
	/** `\begin{env}\item …`; set `ordered` or `description` to change the marker. */
	lists?: Record<string, { ordered?: boolean; description?: boolean }>;
	/** Display-math environments, edited as source with a live preview. */
	math?: readonly string[];
	/** Environments whose body is not LaTeX. */
	code?: readonly string[];
	/** Figures, tables and similar floats. */
	floats?: readonly string[];
	/** Block quotes. */
	quotes?: readonly string[];
	/** Environments that wrap blocks: abstracts, theorems, proofs, alignment wrappers. */
	containers?: Record<string, ContainerSpec>;
};

/** `name` plus `name*`, for the many environments that come in both forms. */
export const withStar = (names: readonly string[]): string[] => names.flatMap((n) => [n, `${n}*`]);
