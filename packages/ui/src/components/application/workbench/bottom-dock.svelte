<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { toast } from "@glyphtex/ui/sonner";
	import {
		IconAlertTriangleFilled,
		IconBug,
		IconBulb,
		IconCircleCheck,
		IconCircleXFilled,
		IconClipboardCheck,
		IconClipboardText,
		IconInfoCircle,
		IconX
	} from "@tabler/icons-svelte";

	import { GLYPHTEX_REPO } from "../about-dialog.svelte";
	import BuildStats from "./build-stats.svelte";
	import type { WorkbenchController } from "./controller.svelte";
	import HistoryView from "./history-view.svelte";
	import type { DockTab } from "./types";

	// Build dock: Problems, raw Log, Builds and History. Errors stay visible over the last good PDF.
	let { ctrl }: { ctrl: WorkbenchController } = $props();

	const files = $derived(ctrl.files);
	const layout = $derived(ctrl.layout);
	const compile = $derived(ctrl.compile);

	const gitReady = $derived(Boolean(files.git && files.scmRoot));
	const { errors, warnings } = $derived(compile.problemSummary);

	const tabs = $derived([
		{ id: "problems" as const, label: "Problems" },
		{ id: "logs" as const, label: "Log" },
		{ id: "stats" as const, label: "Builds" },
		...(gitReady ? [{ id: "history" as const, label: "History" }] : [])
	] satisfies { id: DockTab; label: string }[]);

	let copied = $state(false);

	// No log or file contents go in the URL: a compile log carries the document's
	// own text. The user copies and pastes what they choose to share.
	const ISSUES_URL = `${GLYPHTEX_REPO}/issues`;

	async function copyLog(): Promise<void> {
		if (!compile.compileLog) return;
		try {
			await navigator.clipboard.writeText(compile.compileLog);
			copied = true;
			toast.success("Log copied to clipboard");
			setTimeout(() => (copied = false), 1500);
		} catch {
			toast.error("Could not copy: clipboard blocked");
		}
	}

	function goToProblem(line: number | null | undefined): void {
		if (line == null) return;
		layout.docMode = "latex";
		if (layout.viewMode === "preview") layout.viewMode = "split";
		layout.editor?.goToLine(line);
	}
</script>

{#snippet row(problem: (typeof compile.problems)[number])}
	<span class="mt-0.5 shrink-0">
		<!-- Shape and a word carry severity, not colour alone. -->
		{#if problem.severity === 'info'}
			<IconInfoCircle size={14} class="text-muted-foreground" aria-hidden="true" />
		{:else if problem.severity === 'error'}
			<IconCircleXFilled size={14} class="text-destructive" aria-hidden="true" />
		{:else}
			<IconAlertTriangleFilled size={14} class="text-warning" aria-hidden="true" />
		{/if}
		<span class="sr-only">{problem.severity}:</span>
	</span>
	{#if problem.line != null}
		<span
			class="bg-muted text-muted-foreground mt-px shrink-0 rounded px-1 font-mono text-xs tabular-nums"
		>
			L{problem.line}
		</span>
	{/if}
	<span class="text-foreground min-w-0 flex-1 font-mono text-xs leading-relaxed break-words">
		{problem.message}
	</span>
{/snippet}

<section class="bg-sidebar flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Build output">
	<div class="border-border flex h-9 shrink-0 items-center gap-1 border-b px-2 pl-2.5">
		{#each tabs as tab (tab.id)}
			{@const active = layout.dockTab === tab.id}
			<button
				class="focus-visible:ring-ring cursor-pointer rounded-md px-2 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset {active
					? 'bg-accent text-foreground font-medium'
					: 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}"
				aria-pressed={active}
				onclick={() => (layout.dockTab = tab.id)}
			>
				{tab.label}
				{#if tab.id === 'problems' && (errors || warnings)}
					<span class="ml-1 tabular-nums" aria-hidden="true"
						>{#if errors}<span class="text-destructive">{errors}</span
							>{/if}{#if errors && warnings}<span class="text-muted-foreground">/</span
							>{/if}{#if warnings}<span class="text-warning">{warnings}</span>{/if}</span
					>
					<span class="sr-only"
						>{errors} {errors === 1 ? 'error' : 'errors'}, {warnings}
						{warnings === 1 ? 'warning' : 'warnings'}</span
					>
				{/if}
			</button>
		{/each}

		<div class="ml-auto flex items-center gap-0.5">
			<Button
				variant="ghost"
				size="icon-sm"
				href={ISSUES_URL}
				target="_blank"
				rel="noreferrer noopener"
				title="Report an issue on GitHub"
				aria-label="Report an issue on GitHub"
			>
				<IconBug />
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				class={copied ? 'text-success' : ''}
				title="Copy raw log"
				aria-label="Copy raw log"
				disabled={!compile.compileLog}
				onclick={copyLog}
			>
				{#if copied}<IconClipboardCheck />{:else}<IconClipboardText />{/if}
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				title="Close panel"
				aria-label="Close panel"
				onclick={() => (compile.showProblems = false)}
			>
				<IconX />
			</Button>
		</div>
	</div>

	<!-- Full width: build stats are a tab, not a card taking ~200px off the log. -->
	<div class="min-h-0 flex-1 overflow-auto p-2">
		{#if compile.compileHint}
			<!-- Engine hint (biber/biblatex skew, 0-DPI JPEG), on every tab: it explains the whole build. -->
			<div
				class="border-border bg-card mb-2 flex items-start gap-2 rounded-md border p-2.5"
				role="status"
			>
				<IconBulb size={15} class="text-primary mt-0.5 shrink-0" />
				<p class="text-foreground min-w-0 flex-1 text-xs leading-relaxed">
					{compile.compileHint}
				</p>
			</div>
		{/if}

		{#if layout.dockTab === 'problems'}
			{#if compile.problems.length === 0}
				<div class="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
					<IconCircleCheck size={22} class="opacity-40" />
					<p class="text-xs">No problems reported.</p>
				</div>
			{:else}
				<ul>
					{#each compile.problems as problem, i (i)}
						<li>
							<!-- No line number means a plain row: a disabled button promises a click that does nothing. -->
							{#if problem.line != null}
								<button
									class="hover:bg-accent focus-visible:ring-ring flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset"
									title="Go to line {problem.line}"
									onclick={() => goToProblem(problem.line)}
								>
									{@render row(problem)}
								</button>
							{:else}
								<div class="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left">
									{@render row(problem)}
								</div>
							{/if}
						</li>
					{/each}
				</ul>

				{#if errors}
					<!-- Offered where the failure is, not buried in a help menu. -->
					<p
						class="border-border/60 text-muted-foreground mt-1 border-t px-2 py-2 text-xs leading-relaxed"
					>
						Looks like a GlyphTeX bug rather than your document? Copy the log, then
						<a
							class="text-primary font-medium hover:underline"
							href={ISSUES_URL}
							target="_blank"
							rel="noreferrer noopener"
						>
							report it on GitHub</a
						>.
					</p>
				{/if}
			{/if}
		{:else if layout.dockTab === 'logs'}
			{#if compile.compileLog.trim()}
				<pre
					class="text-muted-foreground px-2 py-1 font-mono text-xs leading-relaxed whitespace-pre-wrap">{compile.compileLog}</pre>
			{:else}
				<p class="text-muted-foreground px-3 py-6 text-center text-xs">No log output yet.</p>
			{/if}
		{:else if layout.dockTab === 'stats'}
			<BuildStats {compile} note={ctrl.statusNote} />
		{:else}
			<HistoryView git={files.git} root={files.scmRoot} refreshKey={files.savedTick} />
		{/if}
	</div>
</section>
