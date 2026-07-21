// One bundle: separate bundles would each get a private copy of the shared
// `latex-workspace` state, so seeding it would not reach the provider under test.
export { registerLatexCompletions } from "../src/lib/editor/latex-complete";
export { registerLatexSemanticTokens } from "../src/lib/editor/latex-semantic";
export {
	setWorkspaceFiles,
	clearWorkspace,
	workspaceBibEntries,
	workspaceLabels,
	workspacePackages,
} from "../src/lib/editor/latex-workspace";
export { parseBib, describeEntry } from "../src/lib/editor/bibtex";
