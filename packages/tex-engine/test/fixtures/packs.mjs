// One compiling document per pack.
//
// A pack is only real if a document using it produces a PDF. Listing files in a
// manifest proves nothing — that gap is how siunitx shipped listed-but-broken —
// so the pack builder converges against these, and the test suite compiles them
// against the built packs.
//
// `String.raw` throughout: these are TeX sources full of backslashes, and
// ordinary escaping turns \b into a backspace and \u into a syntax error.

/** @typedef {{ id: string, source: string }} PackFixture */

/** @type {PackFixture[]} */
export const PACK_FIXTURES = [
	{
		id: 'writing',
		source: String.raw`\documentclass{article}
\usepackage{fancyhdr,titlesec,titling,setspace,parskip,lastpage,appendix,abstract}
\pagestyle{fancy}
\fancyhf{}
\rhead{Page \thepage\ of \pageref{LastPage}}
\titleformat{\section}{\large\bfseries}{\thesection}{1em}{}
\title{A Title}\author{An Author}
\begin{document}
\maketitle
\begin{abstract}A short abstract.\end{abstract}
\onehalfspacing
\section{Section}
Body text with fancy headers and custom section formatting.
\begin{appendices}
\section{An appendix}
\end{appendices}
\end{document}`
	},
	{
		id: 'figures',
		source: String.raw`\documentclass{article}
\usepackage{graphicx,float,wrapfig,subfig,rotating,placeins,adjustbox}
\begin{document}
\begin{figure}[H]\centering\rule{2cm}{1cm}\caption{Held in place.}\end{figure}
\begin{wrapfigure}{r}{3cm}\centering\rule{2cm}{1cm}\caption{Wrapped.}\end{wrapfigure}
Text flowing beside the wrapped figure, with enough words to actually wrap
around it rather than simply sitting above.
\FloatBarrier
\adjustbox{max width=\linewidth}{\rule{20cm}{1cm}}
\begin{figure}[H]\centering
  \subfloat[Left]{\rule{1cm}{1cm}}\qquad\subfloat[Right]{\rule{1cm}{1cm}}
  \caption{Two subfigures.}
\end{figure}
\end{document}`
	},
	{
		id: 'boxes',
		source: String.raw`\documentclass{article}
\usepackage{tcolorbox}
\tcbuselibrary{skins,breakable}
\begin{document}
\begin{tcolorbox}[title=A note]
Boxed content with a title.
\end{tcolorbox}
\begin{tcolorbox}[colback=white,colframe=black]
A second box with explicit colours.
\end{tcolorbox}
\end{document}`
	},
	{
		id: 'review',
		source: String.raw`\documentclass{article}
\usepackage{todonotes,soul,ulem,cancel}
\begin{document}
Some \hl{highlighted} text and some \sout{struck out} text.
\todo[inline]{An inline note.}
$\cancel{x} + y$
\end{document}`
	},
	{
		id: 'science',
		source: String.raw`\documentclass{article}
\usepackage{amsmath,physics,mhchem}
\begin{document}
$\vb{a} \cdot \vb{b}$, $\dv{f}{x}$, $\pdv{f}{y}$.
\ce{2H2 + O2 -> 2H2O}
\end{document}`
	},
	{
		id: 'tables-plus',
		// Striped tables come from xcolor's `table` option, which loads colortbl —
		// absent it, \rowcolor and \rowcolors are both undefined.
		source: String.raw`\documentclass{article}
\usepackage[table]{xcolor}
\usepackage{amsmath,nicematrix,tabularray}
\begin{document}
$\begin{pNiceMatrix} a & b \\ c & d \end{pNiceMatrix}$
\begin{tblr}{lll}
  A & B & C \\
  1 & 2 & 3 \\
\end{tblr}
\rowcolors{2}{gray!10}{white}
\begin{tabular}{ll}
  \rowcolor{gray!30} Header & Value \\
  A & 1 \\
  B & 2 \\
\end{tabular}
\end{document}`
	},
	{
		id: 'references',
		source: String.raw`\documentclass{article}
\usepackage{natbib,csquotes}
\begin{document}
\enquote{A quoted phrase.}
% A manual bibliography needs no BibTeX, so this compiles fully offline.
\citep{knuth1984} and \citet{knuth1984}.
\begin{thebibliography}{9}
  \bibitem[Knuth(1984)]{knuth1984} Knuth, D. \emph{The \TeX book}. 1984.
\end{thebibliography}
\end{document}`
	},
	{
		id: 'drafting',
		source: String.raw`\documentclass{article}
\usepackage{lipsum,blindtext,xstring}
\begin{document}
\lipsum[1]
\blindtext
\end{document}`
	},
	{
		// Madrid pulls a chain (whale, orchid, rounded, infolines); the `include`
		// glob then adds the other themes the fixture never touches.
		id: 'beamer-themes',
		source: String.raw`\documentclass{beamer}
\usetheme{Madrid}
\begin{document}
\begin{frame}{Title}
  \begin{itemize}\item One\item Two\end{itemize}
\end{frame}
\end{document}`
	},
	{
		// Exercises the T1 Type1 path — roman, sans, mono, bold, italic — so the
		// PDF must embed lmodern outlines. The `include` glob (applied before this
		// compiles) supplies the .pfb the font loader needs.
		id: 'fonts-latinmodern',
		source: String.raw`\documentclass{article}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\begin{document}
\rmfamily Roman \textbf{bold} \textit{italic}.
\sffamily Sans \textbf{bold}.
\ttfamily Mono.
\end{document}`
	}
];
