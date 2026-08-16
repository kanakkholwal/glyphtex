import { LanguageSupport, StreamLanguage, type StreamParser } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import type { StringStream } from '@codemirror/language';

import { latexCompletionSource } from './latex-complete';
import { latexHover } from './latex-hover';
import { latexFolding } from './latex-fold';
import { latexSemantics } from './latex-semantic';
import { latexStickyHeadings } from './latex-sticky';

export const LATEX_ID = 'latex';

/** Environments whose bodies are not LaTeX and must not be highlighted. */
const VERBATIM_ENVS = /^\s*\\begin\s*\{(verbatim\*?|lstlisting|minted|Verbatim|alltt|comment)\}/;

type VerbatimState = { env: string | null; inner: unknown };

// stex has no verbatim handling at all, so a `\section` inside a lstlisting body
// would highlight as a real command. Gate the delegate on the enclosing environment.
const latexParser: StreamParser<VerbatimState> = {
	name: LATEX_ID,

	startState(indentUnit) {
		return { env: null, inner: stex.startState?.(indentUnit) };
	},

	copyState(state) {
		return {
			env: state.env,
			inner: stex.copyState ? stex.copyState(state.inner) : state.inner
		};
	},

	token(stream: StringStream, state: VerbatimState) {
		if (state.env) {
			const line = stream.string;
			if (new RegExp(`\\\\end\\s*\\{${state.env}\\}`).test(line)) {
				state.env = null;
				// Fall through: the \end line itself is real LaTeX again.
			} else {
				stream.skipToEnd();
				return 'comment';
			}
		} else if (stream.sol()) {
			const open = VERBATIM_ENVS.exec(stream.string);
			// Set on the \begin line but only takes effect from the next one, so the
			// \begin{lstlisting} itself still reads as a command.
			if (open) state.env = open[1];
		}
		return stex.token(stream, state.inner);
	},

	blankLine(state, indentUnit) {
		if (!state.env) stex.blankLine?.(state.inner, indentUnit);
	},

	languageData: {
		commentTokens: { line: '%' },
		closeBrackets: { brackets: ['{', '[', '(', '$'] },
		// `\command` counts as one word, so double-click selects the whole control
		// sequence and completion filters against the backslash already typed.
		wordChars: '\\@'
	}
};

export const latexStreamLanguage = StreamLanguage.define(latexParser);

/** LaTeX support: highlighting, completion, hover, folding, semantics, sticky headings. */
export function latex(options: { sticky?: boolean } = {}): LanguageSupport {
	return new LanguageSupport(latexStreamLanguage, [
		latexStreamLanguage.data.of({ autocomplete: latexCompletionSource }),
		latexHover(),
		latexFolding(),
		latexSemantics(),
		// Off in the diff view: two panes of pinned headings fight the diff's own
		// collapsed-run markers for the same strip of space.
		options.sticky === false ? [] : latexStickyHeadings()
	]);
}
