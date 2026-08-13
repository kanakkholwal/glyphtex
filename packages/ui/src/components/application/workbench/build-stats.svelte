<script lang="ts">
	import { IconChartBar } from '@tabler/icons-svelte';

	import type { CompileStore } from './compile.svelte';

	/** Build time / pages / output for the last compile, plus a bar chart of recent
	 *  build times so a slowdown shows up before it becomes annoying. */
	let {
		compile,
		note
	}: {
		compile: CompileStore;
		/** Host-supplied engine line (e.g. "Engine: on-device"). */
		note?: string;
	} = $props();

	const builds = $derived(compile.builds);
	const peak = $derived(Math.max(1, ...builds.map((b) => b.ms)));
	const failed = $derived(builds.filter((b) => !b.ok).length);

	function bytes(n: number): string {
		if (!n) return '-';
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
		return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	}
	const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

	// `note` arrives as "Engine: on-device"; the label is the cell's own heading.
	const engine = $derived(note?.replace(/^engine:\s*/i, '') ?? null);

	const stats = $derived([
		{
			label: 'Build time',
			value: compile.lastCompileMs == null ? '-' : seconds(compile.lastCompileMs)
		},
		{ label: 'Pages', value: compile.pdfNumPages ? String(compile.pdfNumPages) : '-' },
		{ label: 'Output', value: bytes(compile.outputBytes) },
		...(engine ? [{ label: 'Engine', value: engine }] : [])
	]);
</script>

<!-- Full width, no card. This used to be a 224px panel pinned beside the log; as
     its own tab that box left three quarters of the dock empty. -->
<div class="px-1 py-1">
	<dl class="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
		{#each stats as stat (stat.label)}
			<div class="min-w-0">
				<dt class="text-faint text-xs">{stat.label}</dt>
				<dd class="text-foreground mt-0.5 truncate text-lg font-medium tabular-nums">
					{stat.value}
				</dd>
			</div>
		{/each}
	</dl>

	<div class="border-border mt-5 border-t pt-4">
		{#if builds.length < 2}
			<div class="text-muted-foreground flex items-center gap-2 py-3 text-xs">
				<IconChartBar size={15} class="opacity-50 shrink-0" />
				<span>Build history appears here after a couple of compiles.</span>
			</div>
		{:else}
			<div class="flex items-baseline justify-between gap-3">
				<h3 class="text-foreground text-xs font-medium">
					Last {builds.length} builds
				</h3>
				<p class="text-faint text-xs tabular-nums">
					peak {seconds(peak)}{#if failed}
						· {failed} failed{/if}
				</p>
			</div>

			<!-- Bars, not a sparkline: builds are discrete events, and each one gets a
			     hit area and a tooltip. Failure is in the count above as well as the
			     colour, so it does not rest on hue alone. -->
			<div
				class="mt-2.5 flex h-16 items-end gap-px"
				role="img"
				aria-label="Build times for the last {builds.length} compiles, peaking at {seconds(
					peak
				)}; {failed} failed"
			>
				{#each builds as build, i (i)}
					<div
						class="min-w-0 flex-1 rounded-t-[2px] transition-colors {build.ok
							? 'bg-brand/50 hover:bg-brand'
							: 'bg-destructive'}"
						style:height={`${Math.max(6, (build.ms / peak) * 100)}%`}
						title="{seconds(build.ms)} · {build.ok ? 'ok' : 'failed'} · {bytes(build.bytes)}"
					></div>
				{/each}
			</div>
		{/if}
	</div>
</div>
