<script lang="ts">
	import type { Extension } from "@codemirror/state";

	/**
	 * DiffView: read-only diff of two texts.
	 * `mode` switches between side-by-side (a MergeView) and unified, which are
	 * two different CodeMirror extensions rather than one option, so switching
	 * rebuilds. Theme / font / language mirror the editor so a diff reads like the
	 * document it came from.
	 */
	let {
		original = "",
		modified = "",
		mode = "side" as "side" | "inline",
		theme = "light" as "light" | "dark",
		language = "latex" as "latex" | "markdown" | "plain",
		fontSize = 13,
		fontFamily = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace"
	}: {
		original?: string;
		modified?: string;
		mode?: "side" | "inline";
		theme?: "light" | "dark";
		language?: "latex" | "markdown" | "plain";
		fontSize?: number;
		fontFamily?: string;
	} = $props();

	let host = $state<HTMLDivElement>();

	// Unlike Monaco's diff editor this cannot reconfigure content in place, so the
	// whole view is rebuilt when anything it renders changes. CodeMirror is loaded
	// dynamically to keep it out of the SSR graph, so the teardown needs the flag.
	$effect(() => {
		const parent = host;
		if (!parent) return;
		const props = { original, modified, mode, theme, language, fontSize, fontFamily };

		let disposed = false;
		let view: { destroy: () => void } | undefined;

		void (async () => {
			const [{ MergeView, unifiedMergeView }, { markdown }, state, view6, glyph] =
				await Promise.all([
					import("@codemirror/merge"),
					import("@codemirror/lang-markdown"),
					import("@codemirror/state"),
					import("@codemirror/view"),
					import("@glyphtex/ui/editor")
				]);
			if (disposed) return;

			const { EditorState } = state;
			const { EditorView, lineNumbers } = view6;
			const language: Extension =
				props.language === "latex"
					? glyph.latex({ sticky: false })
					: props.language === "markdown"
						? markdown()
						: [];

			const base: Extension[] = [
				lineNumbers(),
				EditorView.editable.of(false),
				EditorState.readOnly.of(true),
				EditorView.theme({
					"&": { height: "100%", fontSize: `${props.fontSize}px` },
					".cm-scroller": { fontFamily: props.fontFamily, lineHeight: "1.6", overflow: "auto" }
				}),
				glyph.editorTheme(props.theme),
				language
			];
			// The document-shaped equivalent of a full diff: fold long runs of
			// identical lines so a one-line change isn't buried.
			const collapseUnchanged = { margin: 3, minSize: 4 };

			view =
				props.mode === "side"
					? new MergeView({
							parent,
							a: { doc: props.original, extensions: base },
							b: { doc: props.modified, extensions: base },
							collapseUnchanged,
							highlightChanges: true,
							gutter: true
						})
					: new EditorView({
							parent,
							state: EditorState.create({
								doc: props.modified,
								extensions: [
									...base,
									unifiedMergeView({
										original: props.original,
										mergeControls: false,
										collapseUnchanged
									})
								]
							})
						});
		})().catch((error) => {
			console.error("[GlyphTeX] the diff view failed to load:", error);
		});

		return () => {
			disposed = true;
			view?.destroy();
		};
	});
</script>

<div bind:this={host} class="cm-diff-host h-full min-h-0 w-full text-sm"></div>

<style>
	/* @codemirror/merge ships its own green/red; override with our semantic tokens
	   (never hardcoded colors) so a diff matches the rest of the app in both themes. */
	.cm-diff-host :global(.cm-deletedChunk),
	.cm-diff-host :global(.cm-changedLine.cm-deletedLine) {
		background-color: color-mix(in oklab, var(--color-destructive) 14%, transparent);
	}
	.cm-diff-host :global(.cm-changedLine) {
		background-color: color-mix(in oklab, var(--color-success) 14%, transparent);
	}
	/* the precise text that changed within a line → stronger tint */
	.cm-diff-host :global(.cm-deletedChunk .cm-deletedText) {
		background-color: color-mix(in oklab, var(--color-destructive) 30%, transparent);
	}
	.cm-diff-host :global(.cm-changedText) {
		background: none;
		background-color: color-mix(in oklab, var(--color-success) 30%, transparent);
	}

	/* The two panes need a visible seam, and the collapsed-run placeholder should
	   read as chrome rather than as content. */
	.cm-diff-host :global(.cm-mergeView),
	.cm-diff-host :global(.cm-mergeViewEditors) {
		height: 100%;
	}
	.cm-diff-host :global(.cm-merge-b .cm-editor) {
		border-left: 1px solid var(--color-border);
	}
	.cm-diff-host :global(.cm-collapsedLines) {
		background: var(--color-muted);
		color: var(--color-muted-foreground);
		padding: 2px 8px;
		font-size: 11px;
	}
</style>
