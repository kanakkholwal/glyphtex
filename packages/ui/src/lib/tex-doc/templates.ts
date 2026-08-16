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
export const CARET = "\u0000";

/** The heading a template sits under in the insert menu. */
export type TemplateGroup = "text" | "headings" | "lists" | "math" | "insert";

export type BlockTemplate = {
	id: string;
	label: string;
	group: TemplateGroup;
	keywords: string;
	/** Source to insert, with a single {@link CARET} marking the caret. */
	source: string;
};

export const BLOCK_TEMPLATES: BlockTemplate[] = [
	{
		id: "paragraph",
		label: "Text",
		group: "text",
		keywords: "paragraph prose body",
		source: CARET
	},
	{
		id: "part",
		label: "Part",
		group: "headings",
		keywords: "heading division",
		source: `\\part{${CARET}}`
	},
	{
		id: "chapter",
		label: "Chapter",
		group: "headings",
		keywords: "heading book report",
		source: `\\chapter{${CARET}}`
	},
	{
		id: "section",
		label: "Section",
		group: "headings",
		keywords: "heading h1 title",
		source: `\\section{${CARET}}`
	},
	{
		id: "subsection",
		label: "Subsection",
		group: "headings",
		keywords: "heading h2",
		source: `\\subsection{${CARET}}`
	},
	{
		id: "subsubsection",
		label: "Sub-subsection",
		group: "headings",
		keywords: "heading h3",
		source: `\\subsubsection{${CARET}}`
	},
	{
		id: "paragraph-heading",
		label: "Paragraph heading",
		group: "headings",
		keywords: "heading h4 runin",
		source: `\\paragraph{${CARET}}`
	},
	{
		id: "subparagraph",
		label: "Subparagraph heading",
		group: "headings",
		keywords: "heading h5 runin",
		source: `\\subparagraph{${CARET}}`
	},
	{
		id: "itemize",
		label: "Bulleted list",
		group: "lists",
		keywords: "ul bullet unordered itemize",
		source: `\\begin{itemize}\n  \\item ${CARET}First item\n  \\item Second item\n\\end{itemize}`
	},
	{
		id: "enumerate",
		label: "Numbered list",
		group: "lists",
		keywords: "ol ordered number enumerate",
		source: `\\begin{enumerate}\n  \\item ${CARET}First item\n  \\item Second item\n\\end{enumerate}`
	},
	{
		id: "description",
		label: "Description list",
		group: "lists",
		keywords: "definition term description",
		source: `\\begin{description}\n  \\item[First term] ${CARET}Description of the first term.\n  \\item[Second term] Description of the second term.\n\\end{description}`
	},
	{
		id: "equation",
		label: "Equation",
		group: "math",
		keywords: "math display formula equation numbered",
		source: `\\begin{equation}\n  ${CARET}E = mc^2\n\\end{equation}`
	},
	{
		id: "displaymath",
		label: "Display maths",
		group: "math",
		keywords: "math display unnumbered bracket",
		source: `\\[\n  ${CARET}E = mc^2\n\\]`
	},
	{
		id: "align",
		label: "Aligned equations",
		group: "math",
		keywords: "math align multiline",
		source: `\\begin{align}\n  ${CARET}a &= b + c \\\\\n    &= d + e\n\\end{align}`
	},
	{
		id: "matrix",
		label: "Matrix",
		group: "math",
		keywords: "math pmatrix bmatrix grid vector",
		// Wrapped in display maths: `pmatrix` outside maths mode is a compile error.
		source: `\\[\n  ${CARET}\\begin{pmatrix}\n    a & b \\\\\n    c & d\n  \\end{pmatrix}\n\\]`
	},
	{
		id: "cases",
		label: "Cases",
		group: "math",
		keywords: "math piecewise branch conditional",
		source: `\\[\n  f(x) =\n  \\begin{cases}\n    ${CARET}x & \\text{if } x \\geq 0 \\\\\n    -x & \\text{otherwise}\n  \\end{cases}\n\\]`
	},
	{
		id: "figure",
		label: "Figure",
		group: "insert",
		keywords: "image graphic picture float photo",
		// example-image ships with the mwe package: a real placeholder graphic, so
		// the inserted figure renders on the very first compile.
		source: `\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.6\\linewidth]{example-image}\n  \\caption{${CARET}Caption text.}\n  \\label{fig:placeholder}\n\\end{figure}`
	},
	{
		id: "table",
		label: "Table",
		group: "insert",
		keywords: "tabular grid float",
		source: `\\begin{table}[h]\n  \\centering\n  \\begin{tabular}{l l}\n    \\hline\n    ${CARET}Header 1 & Header 2 \\\\\n    \\hline\n    Cell 1 & Cell 2 \\\\\n    Cell 3 & Cell 4 \\\\\n    \\hline\n  \\end{tabular}\n  \\caption{Caption text.}\n  \\label{tab:placeholder}\n\\end{table}`
	},
	{
		id: "quote",
		label: "Quote",
		group: "insert",
		keywords: "blockquote citation quotation",
		source: `\\begin{quote}\n  ${CARET}Quoted text goes here.\n\\end{quote}`
	},
	{
		id: "verbatim",
		label: "Code block",
		group: "insert",
		keywords: "code verbatim listing monospace",
		source: `\\begin{verbatim}\n${CARET}code goes here\n\\end{verbatim}`
	},
	{
		id: "sample",
		label: "Sample paragraph",
		group: "insert",
		keywords: "lorem ipsum filler placeholder dummy",
		source: `${CARET}Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`
	}
];

/**
 * Things that go inside a paragraph rather than replacing it. The visual editor
 * builds each as an atom; the LaTeX toolbar inserts {@link InlineTemplate.source}.
 */
export type InlineTemplate = {
	id: "math" | "cite" | "ref" | "label" | "footnote" | "link";
	label: string;
	keywords: string;
	source: string;
};

export const INLINE_TEMPLATES: InlineTemplate[] = [
	{ id: "math", label: "Inline maths", keywords: "equation formula dollar", source: `$${CARET}$` },
	{
		id: "cite",
		label: "Citation",
		keywords: "bibliography reference bibtex cite",
		source: `\\cite{${CARET}}`
	},
	{
		id: "ref",
		label: "Cross-reference",
		keywords: "ref link section figure",
		source: `\\ref{${CARET}}`
	},
	{ id: "label", label: "Anchor", keywords: "label target name", source: `\\label{${CARET}}` },
	{
		id: "footnote",
		label: "Footnote",
		keywords: "note aside margin",
		source: `\\footnote{${CARET}}`
	},
	{
		id: "link",
		label: "Link",
		keywords: "url href hyperlink web",
		source: `\\href{https://example.com}{${CARET}}`
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
	return template ? expandTemplate(template.source).text : "";
}

export function inlineTemplate(id: string): InlineTemplate | undefined {
	return INLINE_TEMPLATES.find((t) => t.id === id);
}
