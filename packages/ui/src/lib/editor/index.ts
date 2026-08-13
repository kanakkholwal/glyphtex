export {
	editorTheme,
	islandLightPalette,
	islandDarkPalette,
	type EditorPalette
} from './jetbrains-theme';
export { latex, latexStreamLanguage, LATEX_ID } from './latex-language';
export { latexCompletionSource, latexCompletions, type LatexCompletion } from './latex-complete';
export { latexHover, latexHoverAt, type LatexHover } from './latex-hover';
export { latexFolding, sectionHeadings, type Heading } from './latex-fold';
export { latexSemantics } from './latex-semantic';
export { latexStickyHeadings, enclosingHeadings } from './latex-sticky';
export {
	analyzeSemantics,
	inMathContext,
	scanDocument,
	type DocumentSymbols,
	type SemanticKind,
	type SemanticToken
} from './latex-analyze';
export {
	setWorkspaceFiles,
	clearWorkspace,
	workspaceBibEntries,
	workspaceLabels,
	workspacePackages,
	type WorkspaceFile,
	type WorkspaceLabel
} from './latex-workspace';
export { parseBib, describeEntry, type BibEntry } from './bibtex';
export {
	LATEX_COMMANDS,
	LATEX_ENVIRONMENTS,
	LATEX_PACKAGES,
	LATEX_CLASSES,
	type LatexCommand,
	type LatexEnvironment,
	type LatexPackage,
	type LatexClass
} from './latex-data';
export {
	parseSyncTex,
	SyncTexMap,
	type SyncTexHit,
	type SyncTexRecord,
	type SyncTexLocation
} from './synctex';
export {
	parseLatexLog,
	summarizeProblems,
	type LatexProblem,
	type LatexSeverity,
	type ProblemSummary
} from './latex-log';
