import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet } from '@codemirror/view';

import { analyzeSemantics, type SemanticKind, type SemanticToken } from './latex-analyze';

/** Delay after the last keystroke before the whole document is re-analysed. */
const DEBOUNCE_MS = 220;

const MARKS: Record<SemanticKind, Decoration> = {
	macro: Decoration.mark({ class: 'cm-tex-macro' }),
	unknownMacro: Decoration.mark({ class: 'cm-tex-unknown' }),
	danglingRef: Decoration.mark({ class: 'cm-tex-dangling' }),
	resolvedRef: Decoration.mark({ class: 'cm-tex-resolved' })
};

const setTokens = StateEffect.define<readonly SemanticToken[]>();

function build(tokens: readonly SemanticToken[], docLength: number): DecorationSet {
	const ranges = [];
	for (const token of tokens) {
		// The analysis ran against an older snapshot on a fast typist, so a token can
		// point past the end; clamp rather than letting RangeSet throw.
		const from = Math.min(token.offset, docLength);
		const to = Math.min(token.offset + token.length, docLength);
		if (to > from) ranges.push(MARKS[token.kind].range(from, to));
	}
	return Decoration.set(ranges);
}

const semanticField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(deco, tr) {
		// Map through the edit first so existing highlights follow the text until
		// the next analysis lands, instead of flickering off on every keystroke.
		let next = deco.map(tr.changes);
		for (const effect of tr.effects) {
			if (effect.is(setTokens)) next = build(effect.value, tr.state.doc.length);
		}
		return next;
	},
	provide: (f) => EditorView.decorations.from(f)
});

const semanticWatcher = ViewPlugin.fromClass(
	class {
		#timer: ReturnType<typeof setTimeout> | undefined;

		constructor(view: EditorView) {
			this.#schedule(view, 0);
		}

		update(update: { docChanged: boolean; view: EditorView }) {
			if (update.docChanged) this.#schedule(update.view, DEBOUNCE_MS);
		}

		destroy() {
			clearTimeout(this.#timer);
		}

		#schedule(view: EditorView, delay: number) {
			clearTimeout(this.#timer);
			this.#timer = setTimeout(() => {
				view.dispatch({ effects: setTokens.of(analyzeSemantics(view.state.doc.toString())) });
			}, delay);
		}
	}
);

/** Tints user macros, unknown macros and dangling refs over the base grammar. */
export function latexSemantics(): Extension {
	return [semanticField, semanticWatcher];
}
