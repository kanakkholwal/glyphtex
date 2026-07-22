import type { NewFile } from './projects';

const MAIN = String.raw`\documentclass[11pt]{article}

\usepackage[margin=1in]{geometry}
\usepackage{graphicx}

\title{Untitled}
\author{}
\date{\today}

\begin{document}

\maketitle

\section{Introduction}

Start writing here. Files in this document compile together, so
\verb|\input{sections/notes}| and \verb|\includegraphics| both work.

\input{sections/notes}

\end{document}
`;

const NOTES = String.raw`\section{Notes}

This file is included from \texttt{main.tex}.
`;

export function starterFiles(): NewFile[] {
	return [
		{ path: 'main.tex', text: MAIN },
		{ path: 'sections/notes.tex', text: NOTES }
	];
}
