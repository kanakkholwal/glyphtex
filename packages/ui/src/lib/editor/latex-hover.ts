import type { Extension } from '@codemirror/state';
import { hoverTooltip } from '@codemirror/view';

import { LATEX_COMMANDS } from './latex-data';
import { loadedPackageData } from './latex-packages';

export type LatexHover = {
	from: number;
	to: number;
	name: string;
	detail: string;
	doc?: string;
	package?: string;
};

const COMMAND = /\\([a-zA-Z@]+)/g;

/** Describe the command spanning `pos`, or null when the cursor is over prose. */
export function latexHoverAt(text: string, pos: number): LatexHover | null {
	const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
	const lineEnd = text.indexOf('\n', pos);
	const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
	const column = pos - lineStart;

	COMMAND.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = COMMAND.exec(line))) {
		const start = m.index;
		const end = start + m[0].length;
		if (column < start || column > end) continue;

		const name = m[1];
		const command =
			LATEX_COMMANDS.find((c) => c.name === name) ??
			loadedPackageData().commands.find((c) => c.name === name);
		if (!command) return null;

		return {
			from: lineStart + start,
			to: lineStart + end,
			name,
			detail: command.detail,
			doc: command.doc,
			package: command.package
		};
	}
	return null;
}

export function latexHover(): Extension {
	return hoverTooltip((view, pos) => {
		const hit = latexHoverAt(view.state.doc.toString(), pos);
		if (!hit) return null;

		return {
			pos: hit.from,
			end: hit.to,
			above: true,
			create() {
				const dom = document.createElement('div');
				dom.className = 'cm-latex-hover';

				const head = dom.appendChild(document.createElement('div'));
				head.className = 'cm-latex-hover-head';
				const code = head.appendChild(document.createElement('code'));
				code.textContent = `\\${hit.name}`;
				head.appendChild(document.createTextNode(` ${hit.detail}`));

				if (hit.doc) {
					const body = dom.appendChild(document.createElement('div'));
					body.className = 'cm-latex-hover-body';
					body.textContent = hit.doc;
				}
				if (hit.package) {
					const from = dom.appendChild(document.createElement('div'));
					from.className = 'cm-latex-hover-source';
					from.textContent = `Provided by ${hit.package}`;
				}
				return { dom };
			}
		};
	});
}
