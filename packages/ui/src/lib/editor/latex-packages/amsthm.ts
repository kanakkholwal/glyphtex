/**
 * `amsthm` — theorem environments and proofs.
 *
 * Supplies `\newtheorem` with a notion of *style* (`plain`, `definition`,
 * `remark`) and a `proof` environment that ends in a QED symbol. Nothing is
 * predefined: `theorem`, `lemma` and friends exist only once the preamble
 * declares them.
 *
 * `\theoremstyle` applies to every `\newtheorem` that follows it, so declare
 * the styled groups in order rather than interleaving them.
 */
import type { PackageData } from "./index";

export const data: PackageData = {
	commands: [
		{
			name: "newtheorem",
			snippet: "newtheorem{${1:theorem}}{${2:Theorem}}[${3:section}]$0",
			detail: "Define a numbered theorem environment",
			doc: "Environment name, printed heading, and optionally the counter to number within. The other optional form shares a counter: `\\newtheorem{lemma}[theorem]{Lemma}`.",
			example: "\\newtheorem{theorem}{Theorem}[section]",
			package: "amsthm",
		},
		{
			name: "newtheorem*",
			snippet: "newtheorem*{${1:remark}}{${2:Remark}}$0",
			detail: "Define an unnumbered theorem environment",
			example: "\\newtheorem*{main}{Main Theorem}",
			package: "amsthm",
		},
		{
			name: "theoremstyle",
			snippet: "theoremstyle{${1:plain}}$0",
			detail: "Select the style for subsequent \\newtheorem declarations",
			doc: "`plain` — italic body, bold head (theorems). `definition` — upright body (definitions, examples). `remark` — italic head, upright body (remarks, notes).",
			example: "\\theoremstyle{definition}\n\\newtheorem{definition}{Definition}[section]",
			package: "amsthm",
		},
		{
			name: "newtheoremstyle",
			snippet: "newtheoremstyle{${1:name}}{${2:above}}{${3:below}}{${4:body font}}{${5:indent}}{${6:head font}}{${7:punct}}{${8:head space}}{${9:head spec}}$0",
			detail: "Define a theorem style from its nine parameters",
			doc: "Space above, space below, body font, indent amount, head font, punctuation after the head, space after the head (a space, or `\\newline`), and a custom head specification (empty for the default).",
			example: "\\newtheoremstyle{note}{3pt}{3pt}{}{}{\\bfseries}{.}{.5em}{}",
			package: "amsthm",
		},
		{
			name: "qedhere",
			detail: "Place the QED symbol on this line",
			doc: "Needed when a proof ends with a display — otherwise the box lands alone on the next line. Inside `align`, put it before the closing `\\\\`-less last row.",
			example: "\\[ a = b. \\qedhere \\]",
			package: "amsthm",
			context: "both",
		},
		{
			name: "qedsymbol",
			detail: "The symbol placed at the end of a proof",
			doc: "Redefine it to change the marker: `\\renewcommand{\\qedsymbol}{$\\blacksquare$}`.",
			package: "amsthm",
		},
		{
			name: "swapnumbers",
			detail: "Put the theorem number before the name",
			doc: "Preamble switch affecting every `\\newtheorem` after it — “1.1 Theorem” rather than “Theorem 1.1”.",
			example: "\\swapnumbers",
			package: "amsthm",
		},
		{
			name: "proofname",
			detail: "The word printed at the head of a proof",
			doc: "`\\renewcommand{\\proofname}{Beweis}` — or let babel handle it.",
			package: "amsthm",
		},
		{
			name: "thmname",
			snippet: "thmname{#1}$0",
			detail: "Theorem name, for use in a \\newtheoremstyle head spec",
			package: "amsthm",
		},
		{
			name: "thmnumber",
			snippet: "thmnumber{#2}$0",
			detail: "Theorem number, for use in a \\newtheoremstyle head spec",
			package: "amsthm",
		},
		{
			name: "thmnote",
			snippet: "thmnote{#3}$0",
			detail: "Theorem note, for use in a \\newtheoremstyle head spec",
			doc: "The optional argument of a theorem environment — `\\begin{theorem}[Euler]` — arrives here.",
			package: "amsthm",
		},
		{
			name: "theoremstyle*",
			snippet: "theoremstyle*{${1:plain}}$0",
			detail: "Select a theorem style without resetting the numbering scheme",
			package: "amsthm",
		},
	],
	environments: [
		{
			name: "proof",
			detail: "Proof, ending in a QED symbol",
			body: "\n\t$0\n",
			package: "amsthm",
			context: "text",
		},
		{
			name: "theorem",
			detail: "Theorem (must be declared with \\newtheorem)",
			body: "\n\t$0\n",
			package: "amsthm",
			context: "text",
		},
		{
			name: "lemma",
			detail: "Lemma (must be declared with \\newtheorem)",
			body: "\n\t$0\n",
			package: "amsthm",
			context: "text",
		},
		{
			name: "corollary",
			detail: "Corollary (must be declared with \\newtheorem)",
			body: "\n\t$0\n",
			package: "amsthm",
			context: "text",
		},
		{
			name: "proposition",
			detail: "Proposition (must be declared with \\newtheorem)",
			body: "\n\t$0\n",
			package: "amsthm",
			context: "text",
		},
		{
			name: "definition",
			detail: "Definition — upright body, definition style",
			body: "\n\t$0\n",
			package: "amsthm",
			context: "text",
		},
		{
			name: "remark",
			detail: "Remark — remark style",
			body: "\n\t$0\n",
			package: "amsthm",
			context: "text",
		},
		{
			name: "example",
			detail: "Example — definition style",
			body: "\n\t$0\n",
			package: "amsthm",
			context: "text",
		},
		{
			name: "conjecture",
			detail: "Conjecture (must be declared with \\newtheorem)",
			body: "\n\t$0\n",
			package: "amsthm",
			context: "text",
		},
	],
};
