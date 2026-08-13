import {
	acceptCompletion,
	autocompletion,
	closeBrackets,
	closeBracketsKeymap,
	completionKeymap
} from '@codemirror/autocomplete';
import {
	defaultKeymap,
	history,
	historyKeymap,
	redo,
	redoDepth,
	undo,
	undoDepth
} from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { bracketMatching, codeFolding, foldGutter, foldKeymap } from '@codemirror/language';
import { highlightSelectionMatches } from '@codemirror/search';
import {
	Compartment,
	EditorState,
	StateEffect,
	StateField,
	Transaction,
	type Extension
} from '@codemirror/state';
import {
	Decoration,
	EditorView,
	drawSelection,
	dropCursor,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
	rectangularSelection,
	type DecorationSet
} from '@codemirror/view';
import { editorTheme, latex } from '@glyphtex/ui/editor';

import { applyCase } from '../case-preserve';
import { buildRegex, expandReplacement } from './search';
import type { SearchMatch, SearchOptions } from './types';

export type EditorLanguage = 'latex' | 'markdown' | 'plain';

export type EditorInit = {
	value: string;
	theme: 'light' | 'dark';
	language: EditorLanguage;
	fontSize: number;
	fontFamily: string;
	lineWrapping: boolean;
	readonly: boolean;
};

export type CodeEditorCallbacks = {
	setValue: (v: string) => void;
	setCanUndo: (b: boolean) => void;
	setCanRedo: (b: boolean) => void;
	oncursor?: (pos: { line: number; column: number }) => void;
};

// --- Find/replace highlight --------------------------------------------------
// The app owns its find panel, so matches are painted from a decoration set
// rather than by @codemirror/search's own query state.
const searchMark = Decoration.mark({ class: 'cm-searchMatch' });
const setMatches = StateEffect.define<readonly { from: number; to: number }[]>();

const searchField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(deco, tr) {
		let next = deco.map(tr.changes);
		for (const effect of tr.effects) {
			if (!effect.is(setMatches)) continue;
			const length = tr.state.doc.length;
			next = Decoration.set(
				effect.value
					.filter((m) => m.to > m.from && m.to <= length)
					.map((m) => searchMark.range(m.from, m.to))
			);
		}
		return next;
	},
	provide: (f) => EditorView.decorations.from(f)
});

function languageExtension(lang: EditorLanguage): Extension {
	if (lang === 'latex') return latex();
	if (lang === 'markdown') return markdown();
	return [];
}

// CM6 sizes to its content by default; the workbench panes are resizable, so the
// view has to fill the host instead and scroll internally.
const fillHost = EditorView.theme({
	'&': { height: '100%' },
	'.cm-scroller': { overflow: 'auto' },
	'.cm-content': { paddingTop: '12px', paddingBottom: '12px' }
});

function fontExtension(size: number, family: string): Extension {
	return EditorView.theme({
		'&': { fontSize: `${size}px` },
		'.cm-scroller': { fontFamily: family, lineHeight: '1.6' }
	});
}

export class CodeEditorController {
	view = $state<EditorView>();

	readonly #theme = new Compartment();
	readonly #language = new Compartment();
	readonly #font = new Compartment();
	readonly #wrap = new Compartment();
	readonly #readonly = new Compartment();
	// History lives in a compartment purely so a document switch can clear it by
	// reconfiguring; CM6 exposes no other way to reset the undo stack.
	readonly #history = new Compartment();

	// Last document the undo history belongs to (non-reactive, view-local).
	#lastDocKey: string | null = null;
	readonly #cb: CodeEditorCallbacks;

	constructor(cb: CodeEditorCallbacks) {
		this.#cb = cb;
	}

	/** Mount into `parent`; returns the teardown for the component's mount effect. */
	mount(parent: HTMLElement, init: EditorInit): () => void {
		const view = new EditorView({
			parent,
			state: EditorState.create({ doc: init.value, extensions: this.#extensions(init) })
		});
		this.view = view;
		return () => {
			view.destroy();
			this.view = undefined;
		};
	}

	#extensions(init: EditorInit): Extension[] {
		return [
			fillHost,
			lineNumbers(),
			highlightActiveLineGutter(),
			highlightActiveLine(),
			drawSelection(),
			dropCursor(),
			rectangularSelection(),
			EditorState.allowMultipleSelections.of(true),
			codeFolding(),
			foldGutter(),
			bracketMatching(),
			closeBrackets(),
			highlightSelectionMatches(),
			history(),
			searchField,
			// Prose types mostly words, so the popup opens from the language's own
			// context checks rather than on every character.
			autocompletion({ defaultKeymap: false, icons: false, closeOnBlur: true }),
			keymap.of([
				// Enter inserts a newline; Tab accepts. Prose has far more Enter presses
				// than accepted completions, and the reverse mapping eats paragraphs.
				{ key: 'Tab', run: acceptCompletion },
				...closeBracketsKeymap,
				...completionKeymap.filter((b) => b.key !== 'Enter'),
				...foldKeymap,
				...historyKeymap,
				...defaultKeymap
			]),
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					this.#cb.setValue(update.state.doc.toString());
				}
				if (update.docChanged || update.transactions.length > 0) {
					this.#cb.setCanUndo(undoDepth(update.state) > 0);
					this.#cb.setCanRedo(redoDepth(update.state) > 0);
				}
				if (this.#cb.oncursor && (update.selectionSet || update.docChanged)) {
					const head = update.state.selection.main.head;
					const line = update.state.doc.lineAt(head);
					this.#cb.oncursor({ line: line.number, column: head - line.from + 1 });
				}
			}),
			this.#theme.of(editorTheme(init.theme)),
			this.#language.of(languageExtension(init.language)),
			this.#font.of(fontExtension(init.fontSize, init.fontFamily)),
			this.#wrap.of(init.lineWrapping ? EditorView.lineWrapping : []),
			this.#readonly.of([
				EditorState.readOnly.of(init.readonly),
				EditorView.editable.of(!init.readonly)
			]),
			this.#history.of(history())
		];
	}

	// --- Live reconfiguration ---

	reconfigureTheme(theme: 'light' | 'dark'): void {
		this.view?.dispatch({ effects: this.#theme.reconfigure(editorTheme(theme)) });
	}

	reconfigureLang(language: EditorLanguage): void {
		this.view?.dispatch({ effects: this.#language.reconfigure(languageExtension(language)) });
	}

	reconfigureFont(size: number, family: string): void {
		this.view?.dispatch({ effects: this.#font.reconfigure(fontExtension(size, family)) });
	}

	reconfigureWrap(wrap: boolean): void {
		this.view?.dispatch({
			effects: this.#wrap.reconfigure(wrap ? EditorView.lineWrapping : [])
		});
	}

	reconfigureReadonly(ro: boolean): void {
		this.view?.dispatch({
			effects: this.#readonly.reconfigure([
				EditorState.readOnly.of(ro),
				EditorView.editable.of(!ro)
			])
		});
	}

	/** Reset undo history on document switch, so undo can't reach another file's
	 *  edits. Emptying and refilling the compartment discards the stack. */
	resetHistoryIfDocChanged(key: string): void {
		const view = this.view;
		if (!view || key === this.#lastDocKey) return;
		// First mount has nothing to clear; adopting the key here keeps the initial
		// value and configuration untouched.
		if (this.#lastDocKey === null) {
			this.#lastDocKey = key;
			return;
		}
		this.#lastDocKey = key;
		view.dispatch({ effects: this.#history.reconfigure([]) });
		view.dispatch({ effects: this.#history.reconfigure(history()) });
	}

	/** External value → editor, guarded so typing doesn't loop. Kept out of the
	 *  undo stack: it is a host sync, not something the user did. */
	syncExternalValue(next: string): void {
		const view = this.view;
		if (!view || next === view.state.doc.toString()) return;
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: next },
			annotations: Transaction.addToHistory.of(false)
		});
	}

	// --- Imperative API ---

	wrapSelection(before: string, after: string = before): void {
		const view = this.view;
		if (!view) return;

		const { from, to } = view.state.selection.main;
		const selected = view.state.sliceDoc(from, to);
		view.dispatch({
			changes: { from, to, insert: `${before}${selected}${after}` },
			// Reselect just the original text, now sitting after the opening delimiter.
			selection: { anchor: from + before.length, head: from + before.length + selected.length }
		});
		view.focus();
	}

	insertText(text: string): void {
		const view = this.view;
		if (!view) return;

		const { from, to } = view.state.selection.main;
		// A block snippet (one that closes its own line) belongs on a line of its
		// own; splicing it mid-paragraph produces `Lorem \begin{itemize}…ipsum`.
		const line = view.state.doc.lineAt(from);
		const midLine = from > line.from && line.text.slice(0, from - line.from).trim() !== '';
		const insert = text.endsWith('\n') && midLine ? `\n${text}` : text;

		view.dispatch({
			changes: { from, to, insert },
			selection: { anchor: from + insert.length }
		});
		view.focus();
	}

	focusEditor(): void {
		this.view?.focus();
	}

	selectedText(): string {
		const view = this.view;
		if (!view) return '';
		const { from, to } = view.state.selection.main;
		return view.state.sliceDoc(from, to);
	}

	undo(): void {
		const view = this.view;
		if (!view) return;
		undo(view);
		view.focus();
	}

	redo(): void {
		const view = this.view;
		if (!view) return;
		redo(view);
		view.focus();
	}

	goToLine(line: number): void {
		const view = this.view;
		if (!view) return;

		const n = Math.max(1, Math.min(line, view.state.doc.lines));
		const target = view.state.doc.line(n);
		view.dispatch({
			selection: { anchor: target.from },
			effects: EditorView.scrollIntoView(target.from, { y: 'center' })
		});
		view.focus();
	}

	/** Highlight matches in the editor and return them all for the results list. */
	findAll(o: SearchOptions): SearchMatch[] {
		const view = this.view;
		if (!view) return [];

		const re = buildRegex(o);
		if (!re) {
			this.clearSearch();
			return [];
		}

		const text = view.state.doc.toString();
		const out: SearchMatch[] = [];
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) && out.length < 5000) {
			if (m[0] === '') {
				re.lastIndex++; // guard against zero-width matches
				continue;
			}
			const from = m.index;
			const line = view.state.doc.lineAt(from);
			out.push({
				from,
				to: from + m[0].length,
				line: line.number,
				column: from - line.from + 1,
				text: line.text
			});
		}

		view.dispatch({ effects: setMatches.of(out.map(({ from, to }) => ({ from, to }))) });
		return out;
	}

	/** `focus: false` reveals a match without stealing the caret, so find-next and
	 *  Replace can be pressed repeatedly from the find bar. */
	selectRange(from: number, to: number, opts: { focus?: boolean } = {}): void {
		const view = this.view;
		if (!view) return;

		const max = view.state.doc.length;
		const anchor = Math.max(0, Math.min(from, max));
		const head = Math.max(0, Math.min(to, max));
		view.dispatch({
			selection: { anchor, head },
			effects: EditorView.scrollIntoView(anchor, { y: 'nearest' })
		});
		if (opts.focus !== false) view.focus();
	}

	replaceRange(from: number, to: number, insert: string, opts: { focus?: boolean } = {}): void {
		const view = this.view;
		if (!view) return;

		const max = view.state.doc.length;
		view.dispatch({
			changes: {
				from: Math.max(0, Math.min(from, max)),
				to: Math.max(0, Math.min(to, max)),
				insert
			}
		});
		this.selectRange(from + insert.length, from + insert.length, opts);
	}

	/** Replace every match in one undoable change. Returns the count replaced. */
	replaceAllMatches(o: SearchOptions, replacement: string): number {
		const view = this.view;
		if (!view) return 0;

		const re = buildRegex(o);
		if (!re) return 0;

		const text = view.state.doc.toString();
		const matches = text.match(re);
		const count = matches ? matches.length : 0;
		if (!count) return 0;

		let next: string;
		if (o.preserveCase) {
			// A function replacer so each hit can be recased to match its own text.
			next = text.replace(re, (m: string, ...args: unknown[]) => {
				const groups = args.slice(0, -2) as (string | undefined)[];
				const expanded = o.regexp ? expandReplacement(replacement, m, groups) : replacement;
				return applyCase(m, expanded);
			});
		} else {
			// In regex mode keep $1/$& expansion; otherwise insert the literal text.
			const repl = o.regexp ? replacement : replacement.replace(/\$/g, '$$$$');
			next = text.replace(re, repl);
		}

		// One change over the whole document, so the whole replace-all undoes as a
		// single step rather than match by match.
		view.dispatch({ changes: { from: 0, to: text.length, insert: next } });
		return count;
	}

	/** Clear the highlight (closing the search panel). */
	clearSearch(): void {
		this.view?.dispatch({ effects: setMatches.of([]) });
	}
}
