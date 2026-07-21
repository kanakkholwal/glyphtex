/**
 * `booktabs` — professional table rules.
 *
 * Formal tables use a handful of horizontal rules of graded weight and no
 * vertical rules at all. The package supplies those rules with correct spacing
 * above and below, which is the part `\hline` gets wrong.
 *
 * The convention is one `\toprule`, one `\midrule` under the header, and one
 * `\bottomrule` — never a doubled rule, never a `|` in the column spec.
 */
import type { PackageData } from "./index";

export const data: PackageData = {
	commands: [
		{
			name: "toprule",
			detail: "Heavy rule at the top of a formal table",
			doc: "Optional argument sets the thickness: `\\toprule[1.5pt]`. Only one per table.",
			example: "\\toprule",
			package: "booktabs",
			context: "text",
		},
		{
			name: "midrule",
			detail: "Light rule below the table header",
			doc: "Use instead of `\\hline` inside the table body — it carries the right amount of space with it.",
			example: "\\midrule",
			package: "booktabs",
			context: "text",
		},
		{
			name: "bottomrule",
			detail: "Heavy rule closing a formal table",
			example: "\\bottomrule",
			package: "booktabs",
			context: "text",
		},
		{
			name: "cmidrule",
			snippet: "cmidrule(lr){${1:2-3}}$0",
			detail: "Partial rule spanning selected columns",
			doc: "The parenthesised trim argument shortens the rule so adjacent `\\cmidrule`s do not touch: `l`, `r` or `lr`. Thickness goes in brackets: `\\cmidrule[0.5pt](lr){2-3}`.",
			example: "\\cmidrule(lr){2-4}\\cmidrule(lr){5-7}",
			package: "booktabs",
			context: "text",
		},
		{
			name: "morecmidrules",
			detail: "Separator between two rules on the same line",
			doc: "Required between consecutive `\\cmidrule`s that are meant to stack vertically rather than sit side by side.",
			example: "\\cmidrule{1-2}\\morecmidrules\\cmidrule{1-4}",
			package: "booktabs",
			context: "text",
		},
		{
			name: "addlinespace",
			detail: "Extra vertical space between rows",
			doc: "The way to group rows visually without drawing a rule. Optional argument sets the amount: `\\addlinespace[0.5em]`.",
			example: "\\addlinespace",
			package: "booktabs",
			context: "text",
		},
		{
			name: "specialrule",
			snippet: "specialrule{${1:1pt}}{${2:0pt}}{${3:0pt}}$0",
			detail: "Rule with explicit thickness and space above and below",
			example: "\\specialrule{1pt}{2pt}{2pt}",
			package: "booktabs",
			context: "text",
		},
		{
			name: "heavyrulewidth",
			detail: "Thickness of \\toprule and \\bottomrule",
			doc: "A length: `\\setlength{\\heavyrulewidth}{1pt}`.",
			package: "booktabs",
		},
		{
			name: "lightrulewidth",
			detail: "Thickness of \\midrule",
			package: "booktabs",
		},
		{
			name: "cmidrulewidth",
			detail: "Thickness of \\cmidrule",
			package: "booktabs",
		},
		{
			name: "aboverulesep",
			detail: "Space inserted above a rule",
			package: "booktabs",
		},
		{
			name: "belowrulesep",
			detail: "Space inserted below a rule",
			package: "booktabs",
		},
		{
			name: "cmidrulekern",
			detail: "Amount a trimmed \\cmidrule is shortened by",
			package: "booktabs",
		},
		{
			name: "defaultaddspace",
			detail: "Default amount used by \\addlinespace",
			package: "booktabs",
		},
	],
	environments: [],
};
