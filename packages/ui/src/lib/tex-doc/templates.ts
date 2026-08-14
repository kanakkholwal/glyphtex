/**
 * The block snippets both editors insert.
 *
 * One list, because the visual editor's `/` menu and the LaTeX format toolbar
 * must produce byte-identical LaTeX. A figure inserted in one mode and seen in
 * the other should not look like a different feature.
 *
 * Kept free of any parser import: the toolbar ships in the LaTeX view, which
 * must not pull unified-latex into its bundle.
 */

/** Marks where the caret lands. NUL, because every printable character we might
 *  have used (`|`) occurs in real LaTeX, such as tabular column specs. */
export const CARET = '\u0000';

export type BlockTemplate = {
	id: string;
	label: string;
	keywords: string;
	/** Source to insert, with a single {@link CARET} marking the caret. */
	source: string;
};

export const BLOCK_TEMPLATES: BlockTemplate[] = [
	{
		id: 'paragraph',
		label: 'Text',
		keywords: 'paragraph prose body',
		source: CARET
	},
	{
		id: 'section',
		label: 'Section',
		keywords: 'heading h1 title',
		source: `\\section{${CARET}}`
	},
	{
		id: 'subsection',
		label: 'Subsection',
		keywords: 'heading h2',
		source: `\\subsection{${CARET}}`
	},
	{
		id: 'subsubsection',
		label: 'Sub-subsection',
		keywords: 'heading h3',
		source: `\\subsubsection{${CARET}}`
	},
	{
		id: 'itemize',
		label: 'Bulleted list',
		keywords: 'ul bullet unordered itemize',
		source: `\\begin{itemize}\n  \\item ${CARET}First item\n  \\item Second item\n\\end{itemize}`
	},
	{
		id: 'enumerate',
		label: 'Numbered list',
		keywords: 'ol ordered number enumerate',
		source: `\\begin{enumerate}\n  \\item ${CARET}First item\n  \\item Second item\n\\end{enumerate}`
	},
	{
		id: 'description',
		label: 'Description list',
		keywords: 'definition term description',
		source: `\\begin{description}\n  \\item[First term] ${CARET}Description of the first term.\n  \\item[Second term] Description of the second term.\n\\end{description}`
	},
	{
		id: 'equation',
		label: 'Equation',
		keywords: 'math display formula equation',
		source: `\\begin{equation}\n  ${CARET}E = mc^2\n\\end{equation}`
	},
	{
		id: 'align',
		label: 'Aligned equations',
		keywords: 'math align multiline',
		source: `\\begin{align}\n  ${CARET}a &= b + c \\\\\n    &= d + e\n\\end{align}`
	},
	{
		id: 'figure',
		label: 'Figure',
		keywords: 'image graphic picture float photo',
		// example-image ships with the mwe package: a real placeholder graphic, so
		// the inserted figure renders on the very first compile.
		source: `\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.6\\linewidth]{example-image}\n  \\caption{${CARET}Caption text.}\n  \\label{fig:placeholder}\n\\end{figure}`
	},
	{
		id: 'table',
		label: 'Table',
		keywords: 'tabular grid float',
		source: `\\begin{table}[h]\n  \\centering\n  \\begin{tabular}{l l}\n    \\hline\n    ${CARET}Header 1 & Header 2 \\\\\n    \\hline\n    Cell 1 & Cell 2 \\\\\n    Cell 3 & Cell 4 \\\\\n    \\hline\n  \\end{tabular}\n  \\caption{Caption text.}\n  \\label{tab:placeholder}\n\\end{table}`
	},
	{
		id: 'quote',
		label: 'Quote',
		keywords: 'blockquote citation quotation',
		source: `\\begin{quote}\n  ${CARET}Quoted text goes here.\n\\end{quote}`
	},
	{
		id: 'verbatim',
		label: 'Code block',
		keywords: 'code verbatim listing monospace',
		source: `\\begin{verbatim}\n${CARET}code goes here\n\\end{verbatim}`
	}
];

/** Strip the caret marker, returning the text and where the caret belongs. */
export function expandTemplate(template: string): { text: string; caret: number } {
	const caret = template.indexOf(CARET);
	return caret === -1
		? { text: template, caret: template.length }
		: { text: template.slice(0, caret) + template.slice(caret + 1), caret };
}

/** Ready-to-insert source for a template id, caret marker removed. */
export function templateSource(id: string): string {
	const template = BLOCK_TEMPLATES.find((t) => t.id === id);
	return template ? expandTemplate(template.source).text : '';
}
