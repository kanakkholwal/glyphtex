// Monaco is taken as a parameter and imported as a type only: a runtime import here
// would drag the whole editor into every bundle that touches the grammar.
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
			// `\verb<d>...<d>` needs no state: it is single-line by definition, so an
			// unterminated one falls through to the command rules instead of trapping.
			[/\\verb\*?([^a-zA-Z*\s]).*?\1/, "string"],

			// Math openers must be tested before the generic control-symbol rule
			// below, which would otherwise swallow `\[` and `\(`.
			[/\\\[/, { token: "delimiter.math", next: "@mathBracket" }],
			[/\\\(/, { token: "delimiter.math", next: "@mathParen" }],

			// Escapes must match first, or `50\%` starts a comment and `\$` opens math mode.
			[/\\[^a-zA-Z@\s]/, "keyword"],

			// Verbatim bodies go to a state that emits plain strings until the matching `\end`.
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

			// Display-math environments are `\[…\]` under another name, so same math state.
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

			[
				/(\\(?:begin|end))(\s*)(\{)([^}]*)(\})/,
				["keyword.control", "white", "delimiter.curly", "type", "delimiter.curly"],
			],

			// Cross-references: the key is an identifier, not prose.
			[
				new RegExp(`(\\\\(?:${REF_COMMANDS}))(\\s*)(\\{)([^}]*)(\\})`),
				["keyword.control", "white", "delimiter.curly", "variable", "delimiter.curly"],
			],

			// Both `[...]` forms are matched inline so a stray brace on the next line
			// cannot leak the argument styling.
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

			// A trailing `*` is part of the match but not of the name tested against
			// the structural list.
			[
				/\\([a-zA-Z@]+)\*?/,
				{ cases: { "$1@structural": "keyword.control", "@default": "keyword" } },
			],

			{ include: "@common" },

			[/\$\$/, { token: "delimiter.math", next: "@mathDisplay" }],
			[/\$/, { token: "delimiter.math", next: "@mathInline" }],
		],

		// Escapes are handled by the caller *before* this include.
		common: [
			[/%.*$/, "comment"],
			[/[{}]/, "@brackets"],
			[/[[\]]/, "@brackets"],
			[/\d+(?:\.\d+)?\s*(?:pt|mm|cm|in|ex|em|bp|dd|pc|sp|mu)\b/, "number"],
			[/\d+(?:\.\d+)?/, "number"],
		],

		// One state per math delimiter so each closes only on its own partner:
		// `$…\]` must not terminate.
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
		// pushes another level to keep the pops balanced.
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

		// Each math state matches its closer *after* this include, so `\\` is consumed
		// here before `\]` can be mistaken for it.
		mathBody: [
			[/\\\\/, "keyword"],
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

		// Whitespace is tokenized separately so an *indented* `\end{verbatim}` is still
		// reached by the rule above.
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
	// Monaco's indentation-based folding gets LaTeX wrong: bodies are conventionally
	// unindented, so fold on environments instead.
	folding: {
		markers: {
			start: /\\begin\{[^}]*\}/,
			end: /\\end\{[^}]*\}/,
		},
	},
	// `\command` counts as one word, so double-click selects the whole control
	// sequence and completion filters against the backslash the user just typed.
	wordPattern: /(-?\d*\.\d\w*)|(\\[a-zA-Z@]+)|([^`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?\s]+)/g,
};

/** Registers LaTeX on a dynamically-imported monaco namespace. Idempotent: monaco's
 * registry is global, so re-registering on remount would stack duplicate tokenizers. */
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
