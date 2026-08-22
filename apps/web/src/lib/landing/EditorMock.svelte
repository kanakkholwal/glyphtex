<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import {
		IconChevronDown,
		IconChevronRight,
		IconFilePlus,
		IconFiles,
		IconFileText,
		IconFolder,
		IconFolderOpen,
		IconGitBranch,
		IconLayoutSidebarLeftCollapse,
		IconPlayerPlayFilled,
		IconSearch,
		IconX
	} from "@tabler/icons-svelte";

	// A still of the workbench, not a generic editor: the same title bar, view
	// tabs, tab rail, gutter and JetBrains syntax colours the app actually ships.
	// Static and inert on purpose — the hero holds the editor you can type in.

	type Props = { class?: string };
	let { class: className = "" }: Props = $props();

	type Row = {
		name: string;
		depth: number;
		kind: "folder" | "file";
		open?: boolean;
		active?: boolean;
	};

	const tree: Row[] = [
		{ name: "chapters", depth: 0, kind: "folder", open: true },
		{ name: "intro.tex", depth: 1, kind: "file" },
		{ name: "methods.tex", depth: 1, kind: "file" },
		{ name: "results.tex", depth: 1, kind: "file" },
		{ name: "figures", depth: 0, kind: "folder" },
		{ name: "main.tex", depth: 0, kind: "file", active: true },
		{ name: "references.bib", depth: 0, kind: "file" }
	];

	// Each line is one gutter number plus its spans, so the numbers stay glued to
	// the source they belong to.
	type Span = { t: string; c?: "kw" | "str" | "fn" | "cmt" | "num" };
	const lines: Span[][] = [
		[{ t: "\\documentclass", c: "kw" }, { t: "[11pt]{article}" }],
		[{ t: "\\usepackage", c: "kw" }, { t: "{amsmath,graphicx}" }],
		[{ t: "\\addbibresource", c: "kw" }, { t: "{references.bib}" }],
		[],
		[{ t: "\\title", c: "kw" }, { t: "{A local-first workflow}" }],
		[{ t: "\\begin", c: "kw" }, { t: "{document}" }],
		[{ t: "\\maketitle", c: "kw" }],
		[],
		[{ t: "% chapters live in their own files", c: "cmt" }],
		[{ t: "\\input", c: "kw" }, { t: "{chapters/intro}" }],
		[{ t: "\\input", c: "kw" }, { t: "{chapters/methods}" }],
		[],
		[{ t: "\\printbibliography", c: "kw" }],
		[{ t: "\\end", c: "kw" }, { t: "{document}" }]
	];

	const ACTIVE_LINE = 9;
</script>

<div
	class={cn(
		'glyphtex-mock @container flex h-full min-h-[24rem] flex-col bg-background text-foreground',
		className
	)}
>
	<!-- Title bar: breadcrumb on the left, compile state and the build button on
	     the right, exactly where the workbench puts them. -->
	<header class="flex h-11 shrink-0 items-center gap-1.5 border-b border-border bg-card px-2">
		<span class="flex items-center gap-1.5 rounded-md px-1.5 text-sm text-muted-foreground">
			<span class="grid size-5 place-items-center rounded bg-brand text-[10px] font-bold text-brand-foreground">
				G
			</span>
			<span class="hidden @sm:inline">Home</span>
		</span>
		<span class="text-muted-foreground/50">/</span>
		<span class="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium">
			thesis
			<IconChevronDown class="size-3 opacity-50" />
		</span>

		<span class="ml-auto flex items-center gap-1.5">
			<span
				class="hidden items-center gap-1.5 px-2 text-xs tabular-nums text-muted-foreground @sm:inline-flex"
			>
				<span class="size-1.5 rounded-full bg-success"></span>
				Compiled in 1.1s
			</span>
			<span
				class="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-2.5 text-xs font-medium text-brand-foreground"
			>
				<IconPlayerPlayFilled class="size-3.5" />
				Recompile
			</span>
		</span>
	</header>

	<div class="flex min-h-0 flex-1">
		<!-- Side panel -->
		<aside
			class="hidden w-[10.5rem] shrink-0 flex-col border-r border-hairline bg-surface-soft @sm:flex"
		>
			<div class="flex h-10 shrink-0 items-center gap-0.5 border-b border-hairline px-1.5">
				<span
					class="inline-flex h-7 items-center gap-1.5 rounded-md bg-surface-strong px-2 text-xs font-medium"
				>
					<IconFiles class="size-4" />
					Project
				</span>
				<IconSearch class="size-4 text-muted-foreground" />
				<IconGitBranch class="ml-1 size-4 text-muted-foreground" />
				<IconFilePlus class="ml-auto size-4 text-muted-foreground" />
			</div>

			<div class="flex flex-col gap-px px-1.5 pt-2 text-sm">
				{#each tree as row (row.name)}
					<span
						class="flex items-center gap-1.5 rounded-md py-1 pr-2 {row.active
							? 'bg-surface-strong text-foreground'
							: 'text-muted-foreground'}"
						style="padding-left: {row.depth * 12 + 8}px"
					>
						{#if row.kind === 'folder'}
							{#if row.open}
								<IconChevronDown class="size-3 shrink-0 opacity-60" />
								<IconFolderOpen class="size-3.5 shrink-0" stroke-width={1.75} />
							{:else}
								<IconChevronRight class="size-3 shrink-0 opacity-60" />
								<IconFolder class="size-3.5 shrink-0" stroke-width={1.75} />
							{/if}
						{:else}
							<span class="w-3 shrink-0"></span>
							<IconFileText class="size-3.5 shrink-0" stroke-width={1.75} />
						{/if}
						<span class="truncate text-[13px]">{row.name}</span>
					</span>
				{/each}
			</div>

			<div
				class="mt-auto flex items-center gap-1.5 border-t border-hairline px-3 py-2 text-xs text-muted-foreground"
			>
				<IconGitBranch class="size-3.5" />
				main
			</div>
		</aside>

		<div class="flex min-w-0 flex-1 flex-col">
			<!-- Tab rail -->
			<div class="flex h-9 shrink-0 items-stretch border-b border-hairline bg-surface-soft/70">
				<span class="hidden w-9 shrink-0 place-items-center text-muted-foreground @sm:grid">
					<IconLayoutSidebarLeftCollapse class="size-4" />
				</span>
				<span
					class="flex items-center gap-2 border-r border-hairline bg-background px-3 font-mono text-xs text-foreground"
				>
					main.tex
					<IconX class="size-3 opacity-40" />
				</span>
				<span
					class="hidden items-center border-r border-hairline px-3 font-mono text-xs text-muted-foreground @sm:flex"
				>
					intro.tex
				</span>
			</div>

			<div class="flex min-h-0 flex-1">
				<!-- Source, with the real gutter and the real syntax palette -->
				<div class="glyphtex-mock-src min-w-0 flex-1 overflow-hidden py-2 font-mono text-[11.5px] leading-[1.6]">
					{#each lines as spans, i (i)}
						{@const on = i === ACTIVE_LINE}
						<div class="flex gap-3 px-2 {on ? 'glyphtex-mock-line' : ''}">
							<span
								class="w-5 shrink-0 text-right tabular-nums {on
									? 'glyphtex-mock-gutter-on'
									: 'glyphtex-mock-gutter'}"
							>
								{i + 1}
							</span>
							<span class="truncate">
								{#each spans as span, j (j)}
									<span class={span.c ? `glyphtex-mock-${span.c}` : ''}>{span.t}</span>
								{/each}
							</span>
						</div>
					{/each}
				</div>

				<!-- Preview. A PDF page is white in both themes, so this one is too. -->
				<div
					class="hidden w-[46%] shrink-0 flex-col border-l border-hairline bg-surface-strong p-3 @3xl:flex"
				>
					<div class="flex flex-1 flex-col gap-2 rounded-sm bg-white px-5 py-4 shadow-notion">
						<p class="text-center font-serif text-[11px] leading-tight font-semibold text-[#111]">
							A local-first workflow for academic writing
						</p>
						<p class="text-center font-serif text-[8px] text-[#444]">R. Okonkwo</p>
						<p class="mt-1 text-center font-serif text-[8px] font-semibold text-[#111]">Abstract</p>
						<div class="flex flex-col gap-[3px] px-3">
							{#each [96, 100, 92, 100, 74] as w, i (i)}
								<span class="h-[2px] rounded-full bg-[#c9c9c9]" style="width: {w}%"></span>
							{/each}
						</div>
						<p class="mt-1 font-serif text-[8px] font-semibold text-[#111]">1 Introduction</p>
						<div class="flex flex-col gap-[3px]">
							{#each [100, 88, 100, 96] as w, i (i)}
								<span class="h-[2px] rounded-full bg-[#c9c9c9]" style="width: {w}%"></span>
							{/each}
						</div>
						<p class="mt-1 text-center font-serif text-[8px] text-[#111] italic">
							t<sub>total</sub> = t<sub>compile</sub> + t<sub>queue</sub>
						</p>
					</div>
					<p class="mt-2 text-center text-[10px] text-muted-foreground tabular-nums">1 / 24</p>
				</div>
			</div>
		</div>
	</div>
</div>
