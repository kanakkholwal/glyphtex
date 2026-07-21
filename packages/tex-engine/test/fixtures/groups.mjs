// One sample document per package group offered in the installer UI
// (bundle-manifest.json). Each is deliberately small but exercises the feature
// the group exists for, so a failure names the group rather than "LaTeX broke".
//
// `String.raw` throughout: these are TeX sources full of backslashes, and
// ordinary escaping turns \b into a backspace and \u into a syntax error —
// both of which produce baffling failures far from the cause.

/** @typedef {{ id: string, label: string, source: string, expect?: RegExp }} GroupFixture */

/** @type {GroupFixture[]} */
export const GROUP_FIXTURES = [
	{
		id: 'core',
		label: 'Core compiler',
		source: String.raw`\documentclass{article}
\begin{document}
\section{Heading}
Plain text, \emph{emphasis}, and a footnote.\footnote{Like this.}
\end{document}`
	},
	{
		id: 'math',
		label: 'Math',
		source: String.raw`\documentclass{article}
\usepackage{amsmath,amssymb,mathtools}
\begin{document}
\begin{align}
  E &= mc^2 \\
  \int_0^\infty e^{-x^2}\,\mathrm{d}x &= \frac{\sqrt{\pi}}{2}
\end{align}
Symbols: $\alpha\beta\gamma \in \mathbb{R}, \forall x \leq \aleph_0$.
\[ \begin{pmatrix} a & b \\ c & d \end{pmatrix} \]
\end{document}`
	},
	{
		id: 'graphics',
		label: 'Graphics & color',
		source: String.raw`\documentclass{article}
\usepackage{graphicx,xcolor}
\begin{document}
\textcolor{red}{Red text} and \colorbox{yellow}{a highlight}.
\definecolor{brand}{RGB}{37,99,235}\textcolor{brand}{Brand colour.}
\scalebox{1.5}{Scaled}\rotatebox{15}{Rotated}
\end{document}`
	},
	{
		id: 'tables',
		label: 'Tables',
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
	},
	{
		id: 'layout',
		label: 'Layout & links',
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
		id: 'drawing',
		label: 'Diagrams & plots',
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
	},
	{
		id: 'slides',
		label: 'Presentations',
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
		id: 'code',
		label: 'Code & algorithms',
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
	},
	{
		id: 'typography',
		label: 'Typography',
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
];
