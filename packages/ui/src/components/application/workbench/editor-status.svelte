<script lang="ts">
	import { settings } from "@glyphtex/ui/settings";
	import { IconAlertTriangle, IconCheck } from "@tabler/icons-svelte";

	import type { WorkbenchController } from "./controller.svelte";

	/** Status line for the editor column: everything here describes the open
	 *  document, not the app. App-wide state lives in the title bar. Fields drop
	 *  out by *pane* width (container queries), not viewport: the column can be a
	 *  third of a wide window. */
	let { ctrl }: { ctrl: WorkbenchController } = $props();

	const files = $derived(ctrl.files);
	const layout = $derived(ctrl.layout);
	const compile = $derived(ctrl.compile);

	const LANGUAGE: Record<string, string> = {
		latex: "LaTeX",
		markdown: "Markdown",
		plain: "Plain text"
	};

	// Monaco normalises to LF on edit, so this reports what was loaded.
	const eol = $derived(files.source.includes("\r\n") ? "CRLF" : "LF");
	const { errors, warnings } = $derived(compile.problemSummary);
	const diagnostics = $derived(errors + warnings);
</script>

<footer
	class="border-border bg-card text-muted-foreground flex h-6.5 shrink-0 items-center gap-3 overflow-hidden border-t px-3 text-xs whitespace-nowrap"
>
	<span class="tabular-nums">
		Ln {layout.cursor.line}, Col {layout.cursor.column}
	</span>
	<button
		class="hover:text-foreground hidden transition-colors @lg:inline"
		title={settings.lineWrapping ? 'Turn word wrap off' : 'Turn word wrap on'}
		onclick={() => (settings.lineWrapping = !settings.lineWrapping)}
	>
		Wrap: {settings.lineWrapping ? 'on' : 'off'}
	</button>
	<span class="hidden @xl:inline">Spaces: 2</span>
	<span class="hidden @2xl:inline">UTF-8</span>
	<span class="hidden @2xl:inline">{eol}</span>
	<span class="hidden @md:inline">
		{LANGUAGE[files.activeLanguage] ?? files.activeLanguage}
	</span>

	<div class="ml-auto flex shrink-0 items-center gap-3">
		<span class="hidden tabular-nums @3xl:inline">
			{files.lineCount} lines · {files.wordCount} words
		</span>

		<button
			class="inline-flex shrink-0 items-center gap-1 transition-colors hover:text-foreground {errors
				? 'text-destructive'
				: warnings
					? 'text-warning'
					: ''}"
			title="Show problems and the compile log"
			aria-pressed={compile.showProblems}
			aria-label={diagnostics ? `${diagnostics} diagnostics` : 'No problems reported'}
			onclick={() => {
				layout.dockTab = 'problems';
				compile.showProblems = !compile.showProblems;
			}}
		>
			{#if diagnostics}
				<IconAlertTriangle size={13} />
				<span class="tabular-nums">
					{diagnostics}<span class="hidden @md:inline">
						diagnostic{diagnostics === 1 ? '' : 's'}</span
					>
				</span>
			{:else}
				<IconCheck size={13} />
				<span class="hidden @md:inline">No problems</span>
			{/if}
		</button>
	</div>
</footer>
