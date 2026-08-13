import type { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

import { sectionHeadings, type Heading } from './latex-fold';

/** How many enclosing headings to pin. Monaco's sticky scroll caps at 3 lines. */
const MAX_DEPTH = 2;

/** The headings enclosing `line`, outermost first, deepest `MAX_DEPTH` kept. */
export function enclosingHeadings(headings: readonly Heading[], line: number): Heading[] {
	const stack: Heading[] = [];
	for (const heading of headings) {
		if (heading.line > line) break;
		while (stack.length && stack[stack.length - 1].rank >= heading.rank) stack.pop();
		stack.push(heading);
	}
	// The heading on screen needs no pin: it is already the line you are reading.
	if (stack.length && stack[stack.length - 1].line === line) stack.pop();
	return stack.slice(-MAX_DEPTH);
}

class StickyHeadings {
	readonly #dom: HTMLElement;
	#headings: readonly Heading[];
	#shown = '';

	constructor(readonly view: EditorView) {
		this.#headings = sectionHeadings(view.state.doc.toString());
		this.#dom = document.createElement('div');
		this.#dom.className = 'cm-tex-sticky';
		this.#dom.setAttribute('aria-hidden', 'true');
		view.dom.appendChild(this.#dom);
		this.#render();
	}

	update(update: ViewUpdate) {
		if (update.docChanged) this.#headings = sectionHeadings(update.state.doc.toString());
		if (update.docChanged || update.viewportChanged || update.geometryChanged) this.#render();
	}

	destroy() {
		this.#dom.remove();
	}

	// Public so the scroll handler can drive it: CM6 raises no update for scrolls
	// that stay inside the already-rendered viewport.
	render() {
		this.#render();
	}

	#topLine(): number {
		const rect = this.view.scrollDOM.getBoundingClientRect();
		const pos = this.view.posAtCoords({ x: rect.left + 4, y: rect.top + 2 });
		if (pos == null) return 1;
		return this.view.state.doc.lineAt(pos).number;
	}

	#render() {
		const pinned = enclosingHeadings(this.#headings, this.#topLine());
		const key = pinned.map((h) => `${h.line}:${h.title}`).join('|');
		if (key === this.#shown) return;
		this.#shown = key;

		this.#dom.textContent = '';
		this.#dom.style.display = pinned.length ? 'block' : 'none';
		for (const heading of pinned) {
			const row = this.#dom.appendChild(document.createElement('button'));
			row.type = 'button';
			row.className = 'cm-tex-sticky-row';
			row.style.paddingLeft = `${8 + heading.rank * 10}px`;
			row.textContent = heading.title;
			row.onclick = () => {
				this.view.dispatch({
					selection: { anchor: heading.from },
					effects: EditorView.scrollIntoView(heading.from, { y: 'start' })
				});
				this.view.focus();
			};
		}
	}
}

const stickyPlugin = ViewPlugin.fromClass(StickyHeadings);

/**
 * Pins the enclosing `\section` path over the top of the viewport, the job
 * Monaco's stickyScroll did. Overlays rather than occupying a panel, so
 * scrolling past a heading cannot shift the text.
 */
export function latexStickyHeadings(): Extension {
	return [
		stickyPlugin,
		EditorView.domEventHandlers({
			scroll(_event, view) {
				view.plugin(stickyPlugin)?.render();
			}
		})
	];
}
