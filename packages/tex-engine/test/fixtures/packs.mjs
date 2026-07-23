// One compiling document per pack.
//
// A pack is only real if a document using it produces a PDF. Listing files in a
// manifest proves nothing — that gap is how siunitx shipped listed-but-broken —
// so the pack builder converges against these, and the test suite compiles them
// against the built packs.
//
// `String.raw` throughout: these are TeX sources full of backslashes, and
// ordinary escaping turns \b into a backspace and \u into a syntax error.

/**
 * `files` carries companions the document reads — a `.bib` database is the
 * reason it exists, since a bibliography cannot be exercised from one file.
 *
 * @typedef {{ id: string, source: string, files?: Record<string, string> }} PackFixture
 */

/** @type {PackFixture[]} */
export const PACK_FIXTURES = [
	{
		id: 'writing',
		source: String.raw`\documentclass{report}
\usepackage{fancyhdr,titlesec,titling,setspace,parskip,lastpage,appendix,abstract}
\usepackage{titletoc,tocloft,emptypage,ragged2e,secdot}
\usepackage[intoc]{nomencl}
\makenomenclature
\pagestyle{fancy}
\fancyhf{}
\rhead{Page \thepage\ of \pageref{LastPage}}
\titleformat{\section}{\large\bfseries}{\thesection}{1em}{}
\sectiondot{section}
\title{A Title}\author{An Author}
\begin{document}
\maketitle
\begin{abstract}A short abstract.\end{abstract}
\tableofcontents
\printnomenclature
\onehalfspacing
\chapter{Chapter}
\section{Section}
\nomenclature{$c$}{speed of light}
\Centering Body text with fancy headers and custom section formatting.
\begin{appendices}
\chapter{An appendix}
\end{appendices}
\end{document}`
	},
	{
		id: 'figures',
		source: String.raw`\documentclass{article}
\usepackage{graphicx,float,wrapfig,subfig,rotating,placeins,adjustbox}
\usepackage{pdflscape,afterpage,pdfpages,eso-pic}
\AddToShipoutPictureBG*{}
\begin{document}
\afterpage{\begin{landscape}
  \begin{figure}\centering\rule{6cm}{2cm}\caption{Turned sideways.}\end{figure}
\end{landscape}}
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
		// biblatex, not natbib, because the two cannot share a document and this
		// is the route with the deeper dependency closure — it is what drags in
		// logreq and the blx-* internals that a glob would have to guess at.
		// natbib is a single file the pack's include list carries instead.
		id: 'references',
		files: {
			'refs.bib': String.raw`@book{knuth1984,
  author    = {Donald E. Knuth},
  title     = {The {\TeX}book},
  publisher = {Addison-Wesley},
  year      = {1984}
}`
		},
		source: String.raw`\documentclass{article}
\usepackage{csquotes}
\usepackage[backend=bibtex]{biblatex}
\addbibresource{refs.bib}
\begin{document}
\enquote{A quoted phrase} from \cite{knuth1984}.
\printbibliography
\end{document}`
	},
	{
		id: 'drafting',
		source: String.raw`\documentclass{article}
\usepackage{lipsum,blindtext,xstring}
\usepackage{paralist,enumitem}
\begin{document}
\lipsum[1]
\blindtext
\begin{compactitem}\item Tight\item List\end{compactitem}
\begin{itemize}[nosep,label=\textbullet]\item Spaced by enumitem\end{itemize}
\end{document}`
	},
	{
		id: 'algorithms',
		source: String.raw`\documentclass{article}
\usepackage{algorithm}
\usepackage[noend]{algpseudocode}
\begin{document}
\begin{algorithm}
\caption{Sum a list}
\begin{algorithmic}[1]
\Procedure{Sum}{$xs$}
  \State $s \gets 0$
  \For{$x \in xs$}
    \State $s \gets s + x$
  \EndFor
  \State \Return $s$
\EndProcedure
\end{algorithmic}
\end{algorithm}
\end{document}`
	},
	{
		// The classes are `include`d rather than converged: a fixture can only ever
		// set \documentclass once, so one document cannot exercise three of them.
		// IEEEtrantools is deliberately not loaded here — it refuses to run under
		// IEEEtran, which already provides the same environments.
		id: 'journal-classes',
		source: String.raw`\documentclass[conference]{IEEEtran}
\begin{document}
\title{A Conference Paper}
\author{\IEEEauthorblockN{An Author}\IEEEauthorblockA{An Institution}}
\maketitle
\begin{abstract}
A short abstract for a conference submission.
\end{abstract}
\section{Introduction}
Body text set in the IEEE conference class.
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
