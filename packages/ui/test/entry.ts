// One bundle: separate bundles would each get a private copy of the shared
// `latex-workspace` state, so seeding it would not reach the code under test.
export { latexCompletions, toSnippetTemplate } from "../src/lib/editor/latex-complete";
export { latexHoverAt } from "../src/lib/editor/latex-hover";
export { analyzeSemantics, scanDocument, inMathContext } from "../src/lib/editor/latex-analyze";
export { sectionHeadings } from "../src/lib/editor/latex-fold";
export { enclosingHeadings } from "../src/lib/editor/latex-sticky";
export {
	setWorkspaceFiles,
	clearWorkspace,
	workspaceBibEntries,
	workspaceLabels,
	workspacePackages
} from "../src/lib/editor/latex-workspace";
export { parseBib, describeEntry } from "../src/lib/editor/bibtex";
