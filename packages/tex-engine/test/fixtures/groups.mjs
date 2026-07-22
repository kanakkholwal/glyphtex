// Every package bundle-manifest.json promises must appear in some document here:
// `bundle:verify` only checks presence, which is how siunitx shipped unusable.
// `String.raw` throughout — plain strings turn \b into a backspace, \u into a syntax error.

/** @typedef {{ label: string, source: string }} Sample */
/** @typedef {{ id: string, label: string, documents: Sample[] }} GroupFixture */

/** @type {GroupFixture[]} */
export const GROUP_FIXTURES = [
	{
		id: 'core',
		label: 'Core compiler',
		documents: [
			{
				label: 'article',
				source: String.raw`\documentclass{article}
\begin{document}
\section{Heading}
Plain text, \emph{emphasis}, and a footnote.\footnote{Like this.}
\end{document}`
			},
			{
				// The base/near-universal packages that open most real preambles.
				// A bare fixture left these out of core, so documents failed on
				// inputenc/fontenc — files present in every TeX install but not ours.
				label: 'essential preamble',
				source: String.raw`\documentclass{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[english]{babel}
\usepackage{textcomp,latexsym,verbatim,multicol}
\begin{document}
Text with \texttrademark{} and \S symbols.
\begin{multicols}{2}
\verb|verbatim| and \begin{verbatim}literal\end{verbatim}
\end{multicols}
\end{document}`
			},
			{
				label: 'report',
				source: String.raw`\documentclass{report}
\begin{document}
\chapter{First chapter}
\section{A section}
Report class uses chapters.
\end{document}`
			},
			{
				label: 'book',
				source: String.raw`\documentclass{book}
\begin{document}
\frontmatter
\chapter{Preface}
\mainmatter
\chapter{Opening}
Book class distinguishes front and main matter.
\end{document}`
			}
		]
	},
	{
		id: 'math',
		label: 'Math',
		documents: [
			{
				label: 'amsmath + amssymb + mathtools',
				source: String.raw`\documentclass{article}
\usepackage{amsmath,amssymb,mathtools}
\begin{document}
\begin{align}
  E &= mc^2 \\
  \int_0^\infty e^{-x^2}\,\mathrm{d}x &= \frac{\sqrt{\pi}}{2}
\end{align}
Symbols: $\alpha\beta\gamma \in \mathbb{R}, \forall x \leq \aleph_0$.
\[ \begin{pmatrix} a & b \\ c & d \end{pmatrix} \]
% dcases is a math-mode environment (mathtools), so it needs the \[ \] around it.
\[ f(x) = \begin{dcases} x & x > 0 \\ 0 & \text{otherwise} \end{dcases} \]
\end{document}`
			}
		]
	},
	{
		id: 'graphics',
		label: 'Graphics & color',
		documents: [
			{
				label: 'graphicx + xcolor',
				source: String.raw`\documentclass{article}
\usepackage{graphicx,xcolor}
\begin{document}
\textcolor{red}{Red text} and \colorbox{yellow}{a highlight}.
\definecolor{brand}{RGB}{37,99,235}\textcolor{brand}{Brand colour.}
\scalebox{1.5}{Scaled}\rotatebox{15}{Rotated}\resizebox{2cm}{!}{Resized}
\end{document}`
			}
		]
	},
	{
		id: 'tables',
		label: 'Tables',
		documents: [
			{
				label: 'booktabs + tabularx + array + longtable + multirow',
				source: String.raw`\documentclass{article}
\usepackage{booktabs,tabularx,array,longtable,multirow}
\begin{document}
\begin{tabularx}{\linewidth}{lXr}
  \toprule
  Item & Description & Qty \\
  \midrule
  \multirow{2}{*}{Bolt} & Hex head & 12 \\
                        & Washer   &  8 \\
  \bottomrule
\end{tabularx}
\begin{longtable}{ll}
  A & 1 \\ B & 2 \\
\end{longtable}
\end{document}`
			}
		]
	},
	{
		id: 'layout',
		label: 'Layout & links',
		documents: [
			{
				label: 'geometry + hyperref + enumitem + caption',
				source: String.raw`\documentclass{article}
\usepackage[margin=2cm]{geometry}
\usepackage{hyperref,enumitem,caption}
\begin{document}
\tableofcontents
\section{Section}\label{sec:one}
See \hyperref[sec:one]{this section} and \url{https://example.com}.
\begin{itemize}[noitemsep,leftmargin=*]
  \item First
  \item Second
\end{itemize}
\begin{figure}[h]\centering\rule{2cm}{1cm}\caption{A caption.}\end{figure}
\end{document}`
			},
			{
				label: 'subcaption + cleveref',
				source: String.raw`\documentclass{article}
\usepackage{graphicx,caption,subcaption}
\usepackage{hyperref}
\usepackage{cleveref}
\begin{document}
\section{Section}\label{sec:a}
\begin{figure}[h]
  \centering
  \begin{subfigure}{0.4\linewidth}\centering\rule{1cm}{1cm}\caption{Left}\label{fig:l}\end{subfigure}
  \begin{subfigure}{0.4\linewidth}\centering\rule{1cm}{1cm}\caption{Right}\label{fig:r}\end{subfigure}
  \caption{Two panels.}\label{fig:both}
\end{figure}
\cref{sec:a} contains \cref{fig:both}, made of \cref{fig:l} and \cref{fig:r}.
\end{document}`
			}
		]
	},
	{
		id: 'drawing',
		label: 'Diagrams & plots',
		documents: [
			{
				label: 'tikz + pgfplots',
				source: String.raw`\documentclass{article}
\usepackage{tikz,pgfplots}
\pgfplotsset{compat=1.18}
\begin{document}
\begin{tikzpicture}
  \draw[thick,->] (0,0) -- (2,1);
  \node[draw,circle] at (3,0) {n};
\end{tikzpicture}
\begin{tikzpicture}
  \begin{axis}[width=6cm,height=4cm]
    \addplot coordinates {(0,0) (1,1) (2,4) (3,9)};
  \end{axis}
\end{tikzpicture}
\end{document}`
			}
		]
	},
	{
		id: 'slides',
		label: 'Presentations',
		documents: [
			{
				label: 'beamer',
				source: String.raw`\documentclass{beamer}
\begin{document}
\begin{frame}{Title slide}
  \begin{itemize}
    \item First point
    \item Second point
  \end{itemize}
\end{frame}
\begin{frame}{Maths on a slide}
  $\displaystyle \sum_{i=1}^{n} i = \frac{n(n+1)}{2}$
\end{frame}
\end{document}`
			},
			{
				// A real deck's preamble. The small sizes are the point: beamer's sans
				// at \tiny asks for ec-lmss8, whose T1 metrics the plain lm* glob missed,
				// and the whole document then typeset into nullfont.
				label: 'beamer + T1 sans at small sizes',
				source: String.raw`\documentclass[11pt]{beamer}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{microtype}
\title{Report}
\author{An Author}
\institute{An Institute}
\date{2026}
\begin{document}
\begin{frame}
  \titlepage
\end{frame}
\begin{frame}{Sizes}
  {\tiny Tiny sans text.}

  {\scriptsize Script size text.}

  {\footnotesize Footnote size text.}

  \textbf{Bold} and \textit{italic} and \texttt{mono}.
\end{frame}
\end{document}`
			}
		]
	},
	{
		id: 'code',
		label: 'Code & algorithms',
		documents: [
			{
				label: 'listings + algorithm2e',
				source: String.raw`\documentclass{article}
\usepackage{listings}
\usepackage[ruled,vlined]{algorithm2e}
\begin{document}
\begin{lstlisting}[language=C]
int main(void) { return 0; }
\end{lstlisting}
\begin{algorithm}[H]
  \KwIn{a list}
  \KwOut{the sum}
  $s \leftarrow 0$\;
  \ForEach{item}{$s \leftarrow s + item$\;}
  \Return $s$\;
\end{algorithm}
\end{document}`
			}
		]
	},
	{
		id: 'typography',
		label: 'Typography',
		documents: [
			{
				label: 'microtype + lmodern + siunitx',
				source: String.raw`\documentclass{article}
\usepackage{microtype}
\usepackage{lmodern}
\usepackage{siunitx}
\begin{document}
Microtype adjusts spacing across a justified paragraph, which needs enough
words to actually break across a line or two so the protrusion machinery runs.
Units: \SI{9.81}{\metre\per\second\squared} and \SI{300}{\kelvin}.
\end{document}`
			}
		]
	}
];

export const ALL_SAMPLES = GROUP_FIXTURES.flatMap((g) =>
	g.documents.map((d) => ({ groupId: g.id, groupLabel: g.label, ...d }))
);
