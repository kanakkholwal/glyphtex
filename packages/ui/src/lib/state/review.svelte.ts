import type { EditorApi } from "../../components/application/workbench/types";

/** The open editor and file, shared with the host app's review panel (comments, suggestions). */
class ReviewBridge {
	editor = $state<EditorApi | undefined>(undefined);
	/** Path of the file in the editor, or empty when none is open. */
	path = $state("");
}

export const reviewBridge = new ReviewBridge();
