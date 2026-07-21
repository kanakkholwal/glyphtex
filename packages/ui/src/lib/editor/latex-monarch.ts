/**
 * LaTeX language support for Monaco — Monarch tokenizer + language configuration.
 *
 * Replaces the CodeMirror stex/Lezer grammar (./latex.ts). Monaco is loaded
 * dynamically (it is browser-only and heavy), so this module imports it as a
 * *type* only and takes the namespace as a parameter — a runtime import here
 * would drag the whole editor into every bundle that touches the grammar.
 *
 * Token names are the ones the editor theme styles: keyword, keyword.control,
 * comment, string, variable, type, constant, number, delimiter.{curly,square,math}.
 */
import type * as Monaco from "monaco-editor";
import type { MonacoNamespace } from "./monaco";

export const LATEX_ID = "latex";

/** Commands that carry a `{...}` argument naming a cross-reference target. */
const REF_COMMANDS = "label|eqref|refeq|autoref|nameref|pageref|ref|cite[a-zA-Z]*";

/** Commands whose arguments are file/package names, i.e. strings not prose. */
const FILE_COMMANDS =
	"documentclass|usepackage|RequirePackage|LoadClass|includeonly|include|input|bibliographystyle|bibliography";

/** Environments whose bodies are *not* LaTeX and must not be highlighted. */
const VERBATIM_ENVS = "verbatim\\*?|lstlisting|minted|Verbatim";

/** Environments whose bodies are math, i.e. `\[…\]` under another name. */
const MATH_ENVS =
	"equation\\*?|align(?:at)?\\*?|gather\\*?|multline\\*?|flalign\\*?|eqnarray\\*?|displaymath|math|split|aligned|gathered|cases|array|matrix|[pbvBV]matrix|smallmatrix|subequations";

export const latexLanguage: Monaco.languages.IMonarchLanguage = {
	defaultToken: "",
	tokenPostfix: ".tex",
	ignoreCase: false,

	// Structural commands get `keyword.control` so document scaffolding reads
	// differently from ordinary markup. Everything else falls through to `keyword`.
	structural: [
		"documentclass",
		"usepackage",
		"begin",
		"end",
		"newcommand",
		"renewcommand",
		"def",
		"input",
		"include",
		"section",
		"subsection",
		"subsubsection",
		"chapter",
		"part",
		"paragraph",
		"label",
		"ref",
		"eqref",
		"cite",
		"bibliography",
		"bibliographystyle",
		"item",
		"caption",
		"title",
		"author",
		"date",
		"maketitle",
		"tableofcontents",
	],

	// Greek letters and the common math operators/relations. Inside math mode
	// these read as constants rather than as generic commands.
	mathConstants: [
		"alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta",
		"theta", "vartheta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi",
		"varpi", "rho", "varrho", "sigma", "varsigma", "tau", "upsilon", "phi",
		"varphi", "chi", "psi", "omega",
		"Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Upsilon",
		"Phi", "Psi", "Omega",
		"sum", "prod", "coprod", "int", "iint", "iiint", "oint", "bigcup",
		"bigcap", "bigoplus", "bigotimes", "lim", "limsup", "liminf", "sup",
		"inf", "max", "min", "det", "exp", "ln", "log", "sin", "cos", "tan",
		"arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
		"frac", "dfrac", "tfrac", "binom", "sqrt", "left", "right", "big", "Big",
		"bigg", "Bigg", "hat", "bar", "vec", "dot", "ddot", "tilde", "overline",
		"underline", "overbrace", "underbrace",
		"infty", "partial", "nabla", "forall", "exists", "nexists", "emptyset",
		"varnothing", "aleph", "hbar", "ell", "Re", "Im", "wp", "prime", "cdot",
		"cdots", "ldots", "vdots", "ddots", "times", "div", "pm", "mp", "ast",
		"star", "circ", "bullet", "oplus", "ominus", "otimes", "oslash",
		"leq", "le", "geq", "ge", "neq", "ne", "ll", "gg", "equiv", "sim",
		"simeq", "approx", "cong", "propto", "subset", "subseteq", "supset",
		"supseteq", "in", "ni", "notin", "cup", "cap", "setminus", "perp",
		"parallel", "angle", "triangle", "land", "lor", "lnot", "neg",
		"rightarrow", "leftarrow", "leftrightarrow", "Rightarrow", "Leftarrow",
		"Leftrightarrow", "to", "gets", "mapsto", "implies", "iff",
	],

	brackets: [
		{ open: "{", close: "}", token: "delimiter.curly" },
		{ open: "[", close: "]", token: "delimiter.square" },
		{ open: "(", close: ")", token: "delimiter.parenthesis" },
	],

	tokenizer: {
		root: [
			// `\verb<d>...<d>` is consumed whole via a backreference to the chosen
			// delimiter. It is single-line by definition, so no state is needed —
			// and an unterminated `\verb` simply falls through to the command rules
			// instead of trapping the tokenizer.
			[/\\verb\*?([^a-zA-Z*\s]).*?\1/, "string"],

			// Math openers must be tested before the generic control-symbol rule
			// below, which would otherwise swallow `\[` and `\(`.
			[/\\\[/, { token: "delimiter.math", next: "@mathBracket" }],
			[/\\\(/, { token: "delimiter.math", next: "@mathParen" }],

			// Escapes (`\%`, `\$`, `\{`, `\\`, `\&`, `\_`, `\#`). Matching these
			// first is what keeps `50\%` from starting a comment and `\$` from
			// opening math mode.
			[/\\[^a-zA-Z@\s]/, "keyword"],

			// Verbatim-like environments: highlight the delimiters, then hand the
			// body to a state that emits plain strings until the matching `\end`.
			[
				new RegExp(`(\\\\begin)(\\s*)(\\{)(${VERBATIM_ENVS})(\\})`),
				[
					"keyword.control",
					"white",
					"delimiter.curly",
					"type",
					{ token: "delimiter.curly", next: "@verbatim" },
				],
			],

			// Display-math environments are `\[…\]` under another name, so their
			// bodies get the same math state.
			[
				new RegExp(`(\\\\begin)(\\s*)(\\{)(${MATH_ENVS})(\\})`),
				[
					"keyword.control",
					"white",
					"delimiter.curly",
					"type",
					{ token: "delimiter.curly", next: "@mathEnv" },
				],
			],

			// `\begin{env}` / `\end{env}` — the environment name is the `type`.
			[
				/(\\(?:begin|end))(\s*)(\{)([^}]*)(\})/,
				["keyword.control", "white", "delimiter.curly", "type", "delimiter.curly"],
			],

			// Cross-references: the key is an identifier, not prose.
			[
				new RegExp(`(\\\\(?:${REF_COMMANDS}))(\\s*)(\\{)([^}]*)(\\})`),
				["keyword.control", "white", "delimiter.curly", "variable", "delimiter.curly"],
			],

			// File/package commands, with and without the optional `[...]` argument.
			// Both forms are matched inline (they are single-line in practice) so a
			// stray brace on the next line cannot leak the argument styling.
			[
				new RegExp(`(\\\\(?:${FILE_COMMANDS}))(\\s*)(\\[)([^\\]]*)(\\])(\\s*)(\\{)([^}]*)(\\})`),
				[
					"keyword.control",
					"white",
					"delimiter.square",
					"string",
					"delimiter.square",
					"white",
					"delimiter.curly",
					"string",
					"delimiter.curly",
				],
			],
			[
				new RegExp(`(\\\\(?:${FILE_COMMANDS}))(\\s*)(\\{)([^}]*)(\\})`),
				["keyword.control", "white", "delimiter.curly", "string", "delimiter.curly"],
			],

			// Any other command. Trailing `*` (e.g. `\section*`) is part of the match
			// but not of the name we test against the structural list.
			[
				/\\([a-zA-Z@]+)\*?/,
				{ cases: { "$1@structural": "keyword.control", "@default": "keyword" } },
			],

			{ include: "@common" },

			[/\$\$/, { token: "delimiter.math", next: "@mathDisplay" }],
			[/\$/, { token: "delimiter.math", next: "@mathInline" }],
		],

		// Shared between text and math: comments, brackets and numbers behave the
		// same in both. Escapes are handled by the caller *before* this include.
		common: [
			[/%.*$/, "comment"],
			[/[{}]/, "@brackets"],
			[/[[\]]/, "@brackets"],
			[/\d+(?:\.\d+)?\s*(?:pt|mm|cm|in|ex|em|bp|dd|pc|sp|mu)\b/, "number"],
			[/\d+(?:\.\d+)?/, "number"],
		],

		// One state per math delimiter so each can only be closed by its own
		// partner — `$…\]` must not terminate.
		mathInline: [
			{ include: "@mathBody" },
			[/\$/, { token: "delimiter.math", next: "@pop" }],
		],

		mathDisplay: [
			{ include: "@mathBody" },
			[/\$\$/, { token: "delimiter.math", next: "@pop" }],
			[/\$/, "delimiter.math"],
		],

		mathBracket: [
			{ include: "@mathBody" },
			[/\\\]/, { token: "delimiter.math", next: "@pop" }],
		],

		mathParen: [
			{ include: "@mathBody" },
			[/\\\)/, { token: "delimiter.math", next: "@pop" }],
		],

		// Math environments nest (`aligned` inside `equation`), so a nested `\begin`
		// pushes another level and the pops stay balanced.
		mathEnv: [
			[
				new RegExp(`(\\\\end)(\\s*)(\\{)(${MATH_ENVS})(\\})`),
				[
					"keyword.control",
					"white",
					"delimiter.curly",
					"type",
					{ token: "delimiter.curly", next: "@pop" },
				],
			],
			[
				new RegExp(`(\\\\begin)(\\s*)(\\{)(${MATH_ENVS})(\\})`),
				[
					"keyword.control",
					"white",
					"delimiter.curly",
					"type",
					{ token: "delimiter.curly", next: "@mathEnv" },
				],
			],
			{ include: "@mathBody" },
		],

		// NOTE: the closing delimiter of each math state is matched *after* this
		// include, so `\\` (a line break) is consumed here before `\]` can be
		// mistaken for it — and every rule below consumes at least one character.
		mathBody: [
			[/\\\\/, "keyword"],
			// `\label`/`\ref` are as common inside equations as outside them.
			[
				new RegExp(`(\\\\(?:${REF_COMMANDS}))(\\s*)(\\{)([^}]*)(\\})`),
				["keyword.control", "white", "delimiter.curly", "variable", "delimiter.curly"],
			],
			// The guard tests group 1 — the list holds bare names, without the backslash.
			[/\\([a-zA-Z@]+)/, { cases: { "$1@mathConstants": "constant", "@default": "keyword" } }],
			[/\\[^a-zA-Z@\s\])]/, "keyword"],
			[/[\^_]/, "delimiter"],
			{ include: "@common" },
		],

		// Verbatim bodies: everything is a plain string until the matching `\end`.
		// Whitespace is tokenized separately so an *indented* `\end{verbatim}` is
		// still reached by the rule above (rules are retried at every position).
		verbatim: [
			[
				new RegExp(`(\\\\end)(\\s*)(\\{)(${VERBATIM_ENVS})(\\})`),
				[
					"keyword.control",
					"white",
					"delimiter.curly",
					"type",
					{ token: "delimiter.curly", next: "@pop" },
				],
			],
			[/\s+/, "string"],
			[/[^\s\\]+/, "string"],
			[/\\/, "string"],
		],
	},
};

export const latexConfiguration: Monaco.languages.LanguageConfiguration = {
	comments: {
		lineComment: "%",
	},
	brackets: [
		["{", "}"],
		["[", "]"],
		["(", ")"],
	],
	autoClosingPairs: [
		{ open: "{", close: "}" },
		{ open: "[", close: "]" },
		{ open: "(", close: ")" },
		{ open: "$", close: "$" },
		{ open: "`", close: "'" },
	],
	surroundingPairs: [
		{ open: "{", close: "}" },
		{ open: "[", close: "]" },
		{ open: "(", close: ")" },
		{ open: "$", close: "$" },
		{ open: "`", close: "'" },
	],
	// Environments are the natural fold unit; Monaco's indentation-based folding
	// gets LaTeX wrong because bodies are conventionally unindented.
	folding: {
		markers: {
			start: /\\begin\{[^}]*\}/,
			end: /\\end\{[^}]*\}/,
		},
	},
	wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?\s]+)/g,
};

/**
 * Register the LaTeX language on a dynamically-imported monaco namespace.
 *
 * Idempotent: editors mount and remount, and monaco's registry is global, so
 * re-registering would stack duplicate tokenizers.
 */
export function registerLatex(monaco: MonacoNamespace): void {
	if (monaco.languages.getLanguages().some((lang) => lang.id === LATEX_ID)) return;

	monaco.languages.register({
		id: LATEX_ID,
		extensions: [".tex", ".latex", ".ltx", ".sty", ".cls", ".dtx"],
		aliases: ["LaTeX", "latex", "TeX"],
	});
	monaco.languages.setMonarchTokensProvider(LATEX_ID, latexLanguage);
	monaco.languages.setLanguageConfiguration(LATEX_ID, latexConfiguration);
}
