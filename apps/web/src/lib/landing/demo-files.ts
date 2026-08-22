import type { NewFile } from "$lib/storage/projects";

/** One file in the homepage demo. `language` drives the real editor's highlighting. */
export type DemoFile = {
	path: string;
	text: string;
	language: "latex" | "plain";
};

const MAIN = `\\documentclass[11pt]{article}
\\usepackage{amsmath,graphicx}
\\usepackage[backend=bibtex]{biblatex}
\\addbibresource{references.bib}

\\title{A local-first workflow for academic writing}
\\author{R. Okonkwo}

\\begin{document}
\\maketitle

\\begin{abstract}
  Cloud LaTeX puts a compile queue between a writer and their PDF. We
  describe a workflow in which the engine runs on the writer's own
  machine and the manuscript stays a folder of plain text files.
\\end{abstract}

\\input{sections/intro}

\\section{Method}
Turnaround is bounded by local CPU rather than by queue depth:
\\begin{equation}
  t_{\\text{total}} = t_{\\text{compile}} + t_{\\text{queue}},
  \\qquad t_{\\text{queue}} = 0.
\\end{equation}

\\printbibliography
\\end{document}
`;

const INTRO = `\\section{Introduction}
A thesis is a folder: chapters, figures, and a bibliography. Nothing
about that shape requires a server \\cite{knuth1984}.

\\subsection{Requirements}
\\begin{itemize}
  \\item The source stays plain \\texttt{.tex} and \\texttt{.bib}.
  \\item Every revision is recoverable, forever.
  \\item A draft compiles with the network off.
\\end{itemize}
`;

const BIB = `@book{knuth1984,
  author    = {Knuth, Donald E.},
  title     = {The {\\TeX}book},
  publisher = {Addison-Wesley},
  year      = {1984}
}

@article{lamport1994,
  author  = {Lamport, Leslie},
  title   = {{\\LaTeX}: A Document Preparation System},
  journal = {Addison-Wesley},
  year    = {1994}
}
`;

export const demoFiles: DemoFile[] = [
	{ path: "main.tex", text: MAIN, language: "latex" },
	{ path: "sections/intro.tex", text: INTRO, language: "latex" },
	{ path: "references.bib", text: BIB, language: "plain" }
];

/** The demo's current contents, ready for `createProject`: edits carry across. */
export const demoProjectFiles = (edited: Record<string, string>): NewFile[] =>
	demoFiles.map((file) => ({ path: file.path, text: edited[file.path] ?? file.text }));
