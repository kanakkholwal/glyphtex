/**
 * `hyperref` — hyperlinks, PDF bookmarks and document metadata.
 *
 * Turns every cross-reference, citation and ToC entry into a clickable link and
 * writes the PDF's outline and metadata. It redefines a great deal of the
 * kernel, so it should be loaded LAST — after almost every other package, with
 * `cleveref` the notable exception that comes after it.
 */
import type { PackageData } from "./index";

export const data: PackageData = {
	commands: [
		/* --- links ------------------------------------------------------------ */
		{
			name: "href",
			snippet: "href{${1:https://example.com}}{${2:link text}}$0",
			detail: "Link with your own text",
			doc: "Percent signs and hashes in the URL must be escaped as `\\%` and `\\#`; a trailing `~` needs `\\~{}`.",
			example: "\\href{https://ctan.org}{CTAN}",
			package: "hyperref",
			context: "text",
		},
		{
			name: "url",
			snippet: "url{${1:https://example.com}}$0",
			detail: "Typeset a URL as a live link",
			doc: "Verbatim-ish: the URL is printed as written and broken at sensible points. Use `\\urlstyle{same}` to keep the body font.",
			example: "\\url{https://ctan.org}",
			package: "hyperref",
			context: "text",
		},
		{
			name: "nolinkurl",
			snippet: "nolinkurl{${1:https://example.com}}$0",
			detail: "Typeset a URL without making it clickable",
			example: "\\nolinkurl{internal.example.com/report}",
			package: "hyperref",
			context: "text",
		},
		{
			name: "urlstyle",
			snippet: "urlstyle{${1:same}}$0",
			detail: "Font used for \\url — tt, rm, sf or same",
			example: "\\urlstyle{same}",
			package: "hyperref",
		},
		{
			name: "hyperref",
			snippet: "hyperref[${1:label}]{${2:link text}}$0",
			detail: "Link to a label with arbitrary text",
			doc: "The internal counterpart of `\\href` — the text is yours, the destination is a `\\label`.",
			example: "see \\hyperref[sec:intro]{the introduction}",
			package: "hyperref",
			context: "text",
		},
		{
			name: "hyperlink",
			snippet: "hyperlink{${1:name}}{${2:link text}}$0",
			detail: "Link to a \\hypertarget anchor",
			package: "hyperref",
			context: "text",
		},
		{
			name: "hypertarget",
			snippet: "hypertarget{${1:name}}{${2:text}}$0",
			detail: "Define an anchor for \\hyperlink",
			package: "hyperref",
			context: "text",
		},

		/* --- references ------------------------------------------------------- */
		{
			name: "autoref",
			snippet: "autoref{$1}$0",
			detail: "Reference that prints its own type name",
			doc: "“Figure 3” rather than a bare “3”. Rename the types by redefining `\\figurename`-style hooks such as `\\subsectionautorefname`. For ranges and multiple labels, prefer `cleveref`.",
			example: "as shown in \\autoref{fig:overview}",
			package: "hyperref",
			context: "text",
		},
		{
			name: "autopageref",
			snippet: "autopageref{$1}$0",
			detail: "Page reference with the word “page”",
			package: "hyperref",
			context: "text",
		},
		{
			name: "nameref",
			snippet: "nameref{$1}$0",
			detail: "Reference by section title rather than number",
			example: "the section \\nameref{sec:method}",
			package: "hyperref",
			context: "text",
		},
		{
			name: "ref*",
			snippet: "ref*{$1}$0",
			detail: "Cross-reference with no hyperlink",
			doc: "The starred forms (`\\ref*`, `\\pageref*`, `\\autoref*`) suppress the link — useful inside another link, where nesting is illegal.",
			package: "hyperref",
			context: "text",
		},
		{
			name: "pageref*",
			snippet: "pageref*{$1}$0",
			detail: "Page reference with no hyperlink",
			package: "hyperref",
			context: "text",
		},
		{
			name: "phantomsection",
			detail: "Create an anchor where there is no numbered heading",
			doc: "Put it immediately before `\\addcontentsline` for a starred heading, otherwise the ToC link points at the previous section.",
			example: "\\phantomsection\\addcontentsline{toc}{section}{References}",
			package: "hyperref",
			context: "text",
		},

		/* --- setup and metadata ------------------------------------------------ */
		{
			name: "hypersetup",
			snippet: "hypersetup{\n\tcolorlinks=true,\n\tlinkcolor=${1:blue},\n\tcitecolor=${2:blue},\n\turlcolor=${3:blue},\n}$0",
			detail: "Configure hyperref options",
			doc: "Common keys: `colorlinks` (colour the text instead of boxing it), `linkcolor`/`citecolor`/`urlcolor`/`filecolor`, `hidelinks` (links with no visual marker), `bookmarks`, `bookmarksnumbered`, `breaklinks`, `pdftitle`, `pdfauthor`.",
			example: "\\hypersetup{hidelinks, pdftitle={My Thesis}}",
			package: "hyperref",
		},
		{
			name: "texorpdfstring",
			snippet: "texorpdfstring{${1:TeX version}}{${2:plain text}}$0",
			detail: "Different content for the document and the PDF bookmark",
			doc: "PDF bookmarks are plain text, so maths or formatting in a heading must be given a text-only alternative or hyperref warns on every run.",
			example: "\\section{The \\texorpdfstring{$L^2$}{L2} norm}",
			package: "hyperref",
			context: "text",
		},
		{
			name: "pdfbookmark",
			snippet: "pdfbookmark[${1:1}]{${2:Title}}{${3:anchor}}$0",
			detail: "Add a bookmark to the PDF outline",
			doc: "Level, printed title, unique anchor name. Use it for front matter that has no sectioning command of its own.",
			example: "\\pdfbookmark[1]{Contents}{toc}",
			package: "hyperref",
			context: "text",
		},
		{
			name: "currentpdfbookmark",
			snippet: "currentpdfbookmark{${1:Title}}{${2:anchor}}$0",
			detail: "Bookmark at the current outline level",
			package: "hyperref",
			context: "text",
		},
		{
			name: "belowpdfbookmark",
			snippet: "belowpdfbookmark{${1:Title}}{${2:anchor}}$0",
			detail: "Bookmark one level below the current one",
			package: "hyperref",
			context: "text",
		},
		{
			name: "hypercalcbp",
			snippet: "hypercalcbp{$1}$0",
			detail: "Convert a length to big points for PDF parameters",
			package: "hyperref",
		},

		/* --- forms and files ---------------------------------------------------- */
		{
			name: "Acrobatmenu",
			snippet: "Acrobatmenu{${1:GoToPage}}{${2:text}}$0",
			detail: "Link that triggers a PDF viewer menu action",
			package: "hyperref",
			context: "text",
		},
		{
			name: "TextField",
			snippet: "TextField[name=${1:field}]{${2:Label}}$0",
			detail: "Interactive PDF text field",
			package: "hyperref",
			context: "text",
		},
		{
			name: "CheckBox",
			snippet: "CheckBox[name=${1:field}]{${2:Label}}$0",
			detail: "Interactive PDF check box",
			package: "hyperref",
			context: "text",
		},
		{
			name: "ChoiceMenu",
			snippet: "ChoiceMenu[name=${1:field}]{${2:Label}}{${3:a,b,c}}$0",
			detail: "Interactive PDF choice menu",
			package: "hyperref",
			context: "text",
		},
		{
			name: "PushButton",
			snippet: "PushButton[name=${1:button}]{${2:Label}}$0",
			detail: "Interactive PDF push button",
			package: "hyperref",
			context: "text",
		},
		{
			name: "Submit",
			snippet: "Submit{${1:Send}}$0",
			detail: "Submit button for a PDF form",
			package: "hyperref",
			context: "text",
		},
		{
			name: "Reset",
			snippet: "Reset{${1:Clear}}$0",
			detail: "Reset button for a PDF form",
			package: "hyperref",
			context: "text",
		},
	],
	environments: [
		{
			name: "Form",
			detail: "Wrapper for interactive PDF form fields",
			body: "\n\t$0\n",
			package: "hyperref",
			context: "text",
		},
		{
			name: "NoHyper",
			detail: "Disable hyperref inside a block",
			body: "\n\t$0\n",
			package: "hyperref",
			context: "text",
		},
	],
};
