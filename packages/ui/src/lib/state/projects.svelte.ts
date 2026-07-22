import { PersistedState } from './persisted-state.svelte';

/** One file inside a project (matches the Workbench's internal file shape). */
export type ProjectFile = { id: string; name: string; content: string };

/** A multi-file LaTeX project. Disk-backed (desktop) if `root` is set, in which case
 *  the folder is the source of truth and `files` is only a cached snapshot. */
export type Project = {
	id: string;
	name: string;
	/** Absolute folder path when disk-backed (desktop). Absent for in-memory. */
	root?: string;
	files: ProjectFile[];
	createdAt: number;
	updatedAt: number;
	/** Pinned by the user; drives the Starred scope on the home screen. */
	starred?: boolean;
};

const STARTER_TEX = String.raw`% ${''}New document
\documentclass{article}
\usepackage{amsmath}
\usepackage{graphicx} % \includegraphics for figures
\usepackage{mwe}      % provides the "example-image" placeholder graphic

\title{Untitled}
\author{}
\date{}

\begin{document}
\maketitle

Start writing here.

\end{document}
`;

// Seed shown on first run so the home page is never empty.
const SEED: Project[] = [
	{
		id: 'sample-thesis',
		name: 'Thesis draft',
		createdAt: 1_736_000_000_000,
		updatedAt: 1_736_000_000_000,
		files: [
			{
				id: 'main',
				name: 'main.tex',
				content: String.raw`\documentclass[12pt]{report}
\usepackage{amsmath}

\title{A Local-first Approach to Typesetting}
\author{}
\date{}

\begin{document}
\maketitle
\tableofcontents

\input{chapters/introduction}

\end{document}
`
			},
			{
				id: 'intro',
				name: 'chapters/introduction.tex',
				content: String.raw`\chapter{Introduction}

This chapter motivates keeping unpublished research on your own machine.
`
			},
			{ id: 'refs', name: 'references.bib', content: '' }
		]
	},
	{
		id: 'sample-notes',
		name: 'Lecture notes',
		createdAt: 1_736_100_000_000,
		updatedAt: 1_736_100_000_000,
		files: [
			{
				id: 'main',
				name: 'main.tex',
				content: String.raw`\documentclass{article}
\usepackage{amsmath}

\begin{document}
\section{Week 1}
We observe that $\hat{\theta}$ is consistent, with $\alpha$ scaling as $\beta^2$.
\end{document}
`
			}
		]
	}
];

/** CSS-ident-safe `view-transition-name` shared by a project's home card and its
 *  editor surface, so the two morph into one another. */
export function projectViewTransitionName(id: string): string {
	return `proj-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function uid(prefix = 'p'): string {
	try {
		if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
	} catch {
		/* fall through */
	}
	return `${prefix}-${Math.abs(Math.round(performance.now() * 1000)).toString(36)}`;
}

/** Reactive source of truth for every project, persisted to local storage and
 *  synced across windows. Read `projects.list`; mutations write through. */
class ProjectsStore {
	#store = new PersistedState<Project[]>('glyphtex:projects', SEED);

	/** Most-recently-edited first. */
	get list(): Project[] {
		return [...this.#store.current].sort((a, b) => b.updatedAt - a.updatedAt);
	}

	get(id: string): Project | undefined {
		return this.#store.current.find((p) => p.id === id);
	}

	/** Create a project (with a starter document) and return it. */
	create(name = 'Untitled project'): Project {
		const now = Date.now();
		const project: Project = {
			id: uid(),
			name,
			files: [{ id: 'main', name: 'main.tex', content: STARTER_TEX }],
			createdAt: now,
			updatedAt: now
		};
		this.#store.current = [project, ...this.#store.current];
		return project;
	}

	/** Record (or refresh) a disk-backed folder, deduped by path so re-opening a known
	 *  folder reuses its entry rather than listing it twice. */
	remember(root: string, name?: string): Project {
		const existing = this.#store.current.find((p) => p.root === root);
		if (existing) {
			this.touch(existing.id);
			return this.get(existing.id)!;
		}
		const now = Date.now();
		const base = root.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || 'project';
		const project: Project = {
			id: uid(),
			name: name ?? base,
			root,
			files: [],
			createdAt: now,
			updatedAt: now
		};
		this.#store.current = [project, ...this.#store.current];
		return project;
	}

	/** Lists a scanned folder without touching `updatedAt` (unlike {@link remember}), so
	 *  a directory scan never disturbs last-access order. */
	ensure(root: string, name: string, modified?: number): void {
		if (this.#store.current.some((p) => p.root === root)) return;
		const ts = modified && modified > 0 ? modified : Date.now();
		const project: Project = {
			id: uid(),
			name,
			root,
			files: [],
			createdAt: ts,
			updatedAt: ts
		};
		this.#store.current = [project, ...this.#store.current];
	}

	/** Bump a project's last-edited time (e.g. on open). */
	touch(id: string): void {
		this.#store.current = this.#store.current.map((p) =>
			p.id === id ? { ...p, updatedAt: Date.now() } : p
		);
	}

	rename(id: string, name: string): void {
		this.#store.current = this.#store.current.map((p) =>
			p.id === id ? { ...p, name, updatedAt: Date.now() } : p
		);
	}

	/** Replace a project's files (called as the editor persists). */
	save(id: string, files: ProjectFile[]): void {
		this.#store.current = this.#store.current.map((p) =>
			p.id === id ? { ...p, files, updatedAt: Date.now() } : p
		);
	}

	remove(id: string): void {
		this.#store.current = this.#store.current.filter((p) => p.id !== id);
	}

	/** Duplicate a project under a new id/name. */
	duplicate(id: string): Project | undefined {
		const src = this.get(id);
		if (!src) return undefined;
		const now = Date.now();
		const copy: Project = {
			...structuredClone(src),
			id: uid(),
			name: `${src.name} copy`,
			createdAt: now,
			updatedAt: now
		};
		this.#store.current = [copy, ...this.#store.current];
		return copy;
	}
}

export const projects = new ProjectsStore();
