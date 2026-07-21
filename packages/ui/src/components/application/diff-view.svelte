<script lang="ts">
	import type * as Monaco from 'monaco-editor';
	import { loadMonaco, type MonacoNamespace } from '@glyphx/ui/editor';

	/**
	 * DiffView — read-only diff of two texts, built on Monaco's diff editor.
	 * `mode` switches between VS Code-style side-by-side and inline / unified,
	 * which here is one option rather than two different components. Theme / font
	 * / language mirror the editor so a diff reads like the document it came from.
	 */
	let {
		original = '',
		modified = '',
		mode = 'side' as 'side' | 'inline',
		theme = 'light' as 'light' | 'dark',
		language = 'latex' as 'latex' | 'markdown' | 'plain',
		fontSize = 13,
		fontFamily = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace"
	}: {
		original?: string;
		modified?: string;
		mode?: 'side' | 'inline';
		theme?: 'light' | 'dark';
		language?: 'latex' | 'markdown' | 'plain';
		fontSize?: number;
		fontFamily?: string;
	} = $props();

	let host = $state<HTMLDivElement>();
	let editor = $state<Monaco.editor.IStandaloneDiffEditor>();
	let monaco: MonacoNamespace | undefined;

	const languageId = (lang: 'latex' | 'markdown' | 'plain') =>
		lang === 'latex' ? 'latex' : lang === 'markdown' ? 'markdown' : 'plaintext';

	// Create the diff editor once. Unlike the CodeMirror merge view this one
	// reconfigures in place, so content / theme / font changes below never
	// rebuild it — which keeps scroll position across a recompile.
	$effect(() => {
		const parent = host;
		if (!parent) return;

		let disposed = false;
		void loadMonaco()
			.then((m) => {
				if (disposed) return;
				monaco = m;
				editor = m.editor.createDiffEditor(parent, {
					automaticLayout: true,
					readOnly: true,
					originalEditable: false,
					renderSideBySide: mode === 'side',
					// The document-shaped equivalent of collapseUnchanged: fold long
					// runs of identical lines so a one-line change isn't buried.
					hideUnchangedRegions: { enabled: true, contextLineCount: 3, minimumLineCount: 4 },
					minimap: { enabled: false },
					scrollBeyondLastLine: false,
					lineHeight: 1.6,
					renderOverviewRuler: false,
					scrollbar: { useShadows: false, verticalScrollbarSize: 10, horizontalScrollbarSize: 10 }
				});
			})
			.catch((error) => {
				console.error('[GlyphX] the diff view failed to load:', error);
			});

		return () => {
			disposed = true;
			const current = editor;
			if (current) {
				// Diff models are owned by the global registry, not the editor, so
				// they have to be disposed by hand or every diff leaks two models.
				const model = current.getModel();
				model?.original.dispose();
				model?.modified.dispose();
				current.dispose();
			}
			editor = undefined;
			monaco = undefined;
		};
	});

	// Swap the models whenever the texts or the language change. New models
	// (rather than setValue) keep the diff computation clean and mean the two
	// sides can never disagree about their language.
	$effect(() => {
		const current = editor;
		const m = monaco;
		if (!current || !m) return;

		const id = languageId(language);
		const previous = current.getModel();
		current.setModel({
			original: m.editor.createModel(original, id),
			modified: m.editor.createModel(modified, id)
		});
		previous?.original.dispose();
		previous?.modified.dispose();
	});

	$effect(() => {
		editor?.updateOptions({ renderSideBySide: mode === 'side' });
	});

	$effect(() => {
		void editor;
		monaco?.editor.setTheme(theme === 'dark' ? 'glyphx-island-dark' : 'glyphx-island-light');
	});

	$effect(() => {
		editor?.updateOptions({ fontSize, fontFamily });
	});
</script>

<div bind:this={host} class="h-full min-h-0 w-full text-[13px]"></div>

<style>
	/* Monaco's default diff tints are VS Code's blue/green; override them with
	   our semantic tokens (never hardcoded colors) so a diff matches the rest of
	   the app in both themes. */
	/* removed lines → red tint */
	:global(.monaco-diff-editor .line-delete) {
		background-color: color-mix(in oklab, var(--color-destructive) 14%, transparent) !important;
	}
	/* added lines → green tint */
	:global(.monaco-diff-editor .line-insert) {
		background-color: color-mix(in oklab, var(--color-success) 14%, transparent) !important;
	}
	/* the precise text that changed within a line → stronger tint */
	:global(.monaco-diff-editor .char-delete) {
		background-color: color-mix(in oklab, var(--color-destructive) 30%, transparent) !important;
	}
	:global(.monaco-diff-editor .char-insert) {
		background-color: color-mix(in oklab, var(--color-success) 30%, transparent) !important;
	}

	/* Monaco draws a colored border around each changed region; tint those too
	   rather than leaving VS Code's palette showing through. */
	:global(.monaco-diff-editor .line-delete.char-delete),
	:global(.monaco-diff-editor .inline-deleted-margin-view-zone) {
		border-color: color-mix(in oklab, var(--color-destructive) 40%, transparent) !important;
	}
	:global(.monaco-diff-editor .line-insert.char-insert),
	:global(.monaco-diff-editor .inline-added-margin-view-zone) {
		border-color: color-mix(in oklab, var(--color-success) 40%, transparent) !important;
	}

	/* The +/− glyphs in the change margin, matching the editor's own gutter. */
	:global(.monaco-diff-editor .diff-review-insert),
	:global(.monaco-diff-editor .insert-sign) {
		color: var(--color-success);
	}
	:global(.monaco-diff-editor .diff-review-remove),
	:global(.monaco-diff-editor .delete-sign) {
		color: var(--color-destructive);
	}
</style>
