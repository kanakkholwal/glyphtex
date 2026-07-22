<script lang="ts">
	import type { LatexProblem } from '@glyphx/ui/editor';
	import { toast } from '@glyphx/ui/sonner';
	import {
		IconAlertTriangleFilled,
		IconInfoCircle,
		IconX,
		IconClipboardText,
		IconClipboardCheck,
		IconBulb
	} from '@glyphx/ui/icons';

	/**
	 * ProblemsPanel — Overleaf-style log surface. Two tabs: parsed **Problems**
	 * (errors / warnings with clickable source lines) and the **Raw log** for
	 * deep debugging. Errors stay visible even while the last good PDF is shown.
	 */
	let {
		problems = [],
		log = '',
		hint,
		ongoto,
		onclose
	}: {
		problems?: LatexProblem[];
		log?: string;
		/** Actionable hint for a recognized engine limitation; shown as a banner. */
		hint?: string;
		ongoto?: (line: number) => void;
		onclose?: () => void;
	} = $props();

	let tab = $state<'problems' | 'log'>('problems');
	let copied = $state(false);

	const errors = $derived(problems.filter((p) => p.severity === 'error').length);
	const warnings = $derived(problems.filter((p) => p.severity === 'warning').length);

	async function copyLog() {
		if (!log) return;
		try {
			await navigator.clipboard.writeText(log);
			copied = true;
			toast.success('Log copied to clipboard');
			setTimeout(() => (copied = false), 1500);
		} catch {
			toast.error('Could not copy — clipboard blocked');
		}
	}
</script>

<section class="border-border bg-card flex h-56 shrink-0 flex-col border-t">
	<!-- header -->
	<div class="border-border flex h-9 shrink-0 items-center gap-1 border-b px-2">
		<button
			class="rounded px-2 py-1 text-xs font-medium transition-colors {tab === 'problems'
				? 'bg-muted text-foreground'
				: 'text-muted-foreground hover:text-foreground'}"
			onclick={() => (tab = 'problems')}
		>
			Problems
			{#if errors || warnings}
				<span class="text-muted-foreground/70 ml-1 tabular-nums">
					{#if errors}<span class="text-destructive">{errors}</span>{/if}{#if errors && warnings}/{/if}{#if warnings}<span
							class="text-warning">{warnings}</span
						>{/if}
				</span>
			{/if}
		</button>
		<button
			class="rounded px-2 py-1 text-xs font-medium transition-colors {tab === 'log'
				? 'bg-muted text-foreground'
				: 'text-muted-foreground hover:text-foreground'}"
			onclick={() => (tab = 'log')}
		>
			Raw log
		</button>

		<div class="ml-auto flex items-center gap-0.5">
			<button
				class="hover:bg-muted grid size-6 place-items-center rounded transition-colors {copied
					? 'text-success'
					: 'text-muted-foreground hover:text-foreground'}"
				title="Copy raw log"
				aria-label="Copy raw log"
				onclick={copyLog}
			>
				{#if copied}
					<IconClipboardCheck size={15} />
				{:else}
					<IconClipboardText size={15} />
				{/if}
			</button>
			<button
				class="text-muted-foreground hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
				title="Close panel"
				aria-label="Close panel"
				onclick={() => onclose?.()}
			>
				<IconX size={15} />
			</button>
		</div>
	</div>

	<!-- body -->
	<div class="min-h-0 flex-1 overflow-auto">
		{#if hint}
			<!-- Actionable engine hint (e.g. biber/biblatex skew, 0-DPI JPEG). Shown
			     above the parsed problems / raw log on every tab. -->
			<div
				class="border-primary/30 bg-primary/5 m-2 flex items-start gap-2 rounded-md border p-2.5"
				role="status"
			>
				<IconBulb size={15} class="text-primary mt-0.5 shrink-0" />
				<p class="text-foreground/90 min-w-0 flex-1 text-xs leading-relaxed">{hint}</p>
			</div>
		{/if}
		{#if tab === 'problems'}
			{#if problems.length === 0}
				<p class="text-muted-foreground px-3 py-6 text-center text-xs">No problems reported.</p>
			{:else}
				<ul class="py-1">
					{#each problems as p, i (i)}
						<li>
							<button
								class="hover:bg-muted/60 flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors disabled:cursor-default"
								disabled={p.line == null}
								onclick={() => p.line != null && ongoto?.(p.line)}
								title={p.line != null ? `Go to line ${p.line}` : undefined}
							>
								<span class="mt-0.5 shrink-0">
									{#if p.severity === 'info'}
										<IconInfoCircle size={14} class="text-muted-foreground" />
									{:else}
										<IconAlertTriangleFilled
											size={14}
											class={p.severity === 'error' ? 'text-destructive' : 'text-warning'}
										/>
									{/if}
								</span>
								<span class="text-foreground/90 min-w-0 flex-1 font-mono text-xs leading-relaxed break-words">
									{p.message}
								</span>
								{#if p.line != null}
									<span class="text-muted-foreground/70 shrink-0 font-mono text-[11px] tabular-nums">
										:{p.line}
									</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		{:else if log.trim()}
			<pre
				class="text-muted-foreground px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">{log}</pre>
		{:else}
			<p class="text-muted-foreground px-3 py-6 text-center text-xs">No log output.</p>
		{/if}
	</div>
</section>
