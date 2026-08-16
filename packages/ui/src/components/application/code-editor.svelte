<script lang="ts" module>
	// Public find/replace types kept importable from this component.
	export type { SearchOptions, SearchMatch } from "./code-editor/types";
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	import type { CodeEditorController, EditorLanguage } from './code-editor/controller.svelte';

	/**
	 * CodeEditor: the shared CodeMirror 6 surface (web + desktop).
	 *
	 * Dumb on purpose: theme / language / font come in as props. This component
	 * is a thin shell: all editor state + behaviour live in
	 * {@link CodeEditorController}; here we only bind props/effects to it and
	 * re-export its imperative API via `bind:this`.
	 */
	let {
		value = $bindable(''),
		docKey = '',
		canUndo = $bindable(false),
		canRedo = $bindable(false),
		theme = 'light' as 'light' | 'dark',
		language = 'latex' as EditorLanguage,
		fontSize = 13,
		fontFamily = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace",
		lineWrapping = false,
		readonly = false,
		class: className = '',
		oncursor
	}: {
		value?: string;
		/** Identity of the open document. Changing it resets the undo history so
		 *  undo/redo can never reach into another file's edits. */
		docKey?: string;
		/** Bindable: whether there is anything to undo / redo (drives toolbar state). */
		canUndo?: boolean;
		canRedo?: boolean;
		theme?: 'light' | 'dark';
		/** Highlighting mode. `latex` uses the LaTeX parser; `markdown`/`plain`
		 *  drive non-TeX files (READMEs, code) so they aren't mis-highlighted. */
		language?: EditorLanguage;
		fontSize?: number;
		fontFamily?: string;
		lineWrapping?: boolean;
		readonly?: boolean;
		class?: string;
		/** Fires with the 1-based caret position whenever the selection moves. */
		oncursor?: (pos: { line: number; column: number }) => void;
	} = $props();

	let host = $state<HTMLDivElement>();
	// Set once the controller module has loaded. Reactive so the reconfiguration
	// effects below re-run against the live view the moment it exists.
	let ctrl = $state<CodeEditorController>();

	// Mount once. Initial prop values are read untracked so this effect does not
	// re-run (and re-create the view) when they change: the effects below handle
	// live reconfiguration.
	//
	// The controller is imported dynamically so CodeMirror stays out of the SSR
	// graph: the editor renders nothing on the server, and the Cloudflare Worker
	// has a size budget. Hence the `disposed` flag: the teardown must be sync.
	$effect(() => {
		const parent = host;
		if (!parent) return;
		const init = untrack(() => ({
			value,
			theme,
			language,
			fontSize,
			fontFamily,
			lineWrapping,
			readonly
		}));

		let disposed = false;
		let unmount: (() => void) | undefined;

		void import('./code-editor/controller.svelte')
			.then(({ CodeEditorController }) => {
				if (disposed) return;
				const created = new CodeEditorController({
					setValue: (v) => (value = v),
					setCanUndo: (b) => (canUndo = b),
					setCanRedo: (b) => (canRedo = b),
					oncursor
				});
				unmount = created.mount(parent, init);
				ctrl = created;
			})
			.catch((error) => {
				// Nothing to fall back to, so surface it rather than leaving a blank
				// pane with no explanation.
				console.error('[GlyphTeX] the code editor failed to load:', error);
			});

		return () => {
			disposed = true;
			unmount?.();
			ctrl = undefined;
		};
	});

	// Live reconfiguration: each tracks the controller + one prop set, and no-ops
	// until the dynamic import lands.
	$effect(() => ctrl?.reconfigureTheme(theme));
	$effect(() => ctrl?.reconfigureLang(language));
	$effect(() => ctrl?.reconfigureFont(fontSize, fontFamily));
	$effect(() => ctrl?.reconfigureWrap(lineWrapping));
	$effect(() => ctrl?.reconfigureReadonly(readonly));
	$effect(() => ctrl?.resetHistoryIfDocChanged(docKey));
	$effect(() => ctrl?.syncExternalValue(value));

	// --- Imperative API (accessed via bind:this from a toolbar, etc.) ---------
	/** The controller loads asynchronously; until it does, every method below is
	 *  a no-op, so callers that must not lose their request check this first. */
	export function ready(): boolean {
		return Boolean(ctrl?.view);
	}
	export function wrapSelection(before: string, after?: string) {
		ctrl?.wrapSelection(before, after);
	}
	export function insertText(text: string) {
		ctrl?.insertText(text);
	}
	export function focusEditor() {
		ctrl?.focusEditor();
	}
	export function selectedText(): string {
		return ctrl?.selectedText() ?? '';
	}
	export function undo() {
		ctrl?.undo();
	}
	export function redo() {
		ctrl?.redo();
	}
	export function goToLine(line: number) {
		ctrl?.goToLine(line);
	}
	export function findAll(o: import('./code-editor/types').SearchOptions) {
		return ctrl?.findAll(o) ?? [];
	}
	export function selectRange(from: number, to: number, opts?: { focus?: boolean }) {
		ctrl?.selectRange(from, to, opts);
	}
	export function replaceRange(
		from: number,
		to: number,
		insert: string,
		opts?: { focus?: boolean }
	) {
		ctrl?.replaceRange(from, to, insert, opts);
	}
	export function replaceAllMatches(
		o: import('./code-editor/types').SearchOptions,
		replacement: string
	): number {
		return ctrl?.replaceAllMatches(o, replacement) ?? 0;
	}
	export function clearSearch() {
		ctrl?.clearSearch();
	}
</script>

<div bind:this={host} class="h-full min-h-0 {className}"></div>
