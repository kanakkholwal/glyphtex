<script lang="ts">
	import {
		IconAlertTriangle,
		IconChevronDown,
		IconChevronRight,
		IconChevronUp,
		IconFileOff,
		IconFileText,
		IconFolderOff,
		IconReplace,
		IconReplaceFilled
	} from "@tabler/icons-svelte";
	import { MediaQuery } from "svelte/reactivity";

	import { SEARCH_BTN, SEARCH_COUNT, SEARCH_INPUT, searchPill } from "../search-ui";
	import {
		NO_SKIPS,
		skipSummary,
		type FileMatches,
		type Hit,
		type ScanResult,
		type SearchSkips
	} from "../workbench/project-search";
	import { isDocumentFile } from "../file-kinds";
	import type { SidePanelStore } from "./store.svelte";

	/**
	 * Project search: find/replace across every file, with the toggles inside the
	 * fields (VS Code parity) and results grouped per file.
	 */
	let {
		store,
		result,
		groups,
		total,
		hits,
		activeHit,
		scanning,
		collapsed,
		includeOther = false,
		skips = NO_SKIPS,
		onincludeother,
		ontogglegroup,
		onsearchnext,
		onsearchprev,
		ongotoresult,
		onreplacecurrent,
		onreplaceall
	}: {
		store: SidePanelStore;
		result: ScanResult;
		/** Groups as rendered: documents, plus the excluded ones when opted in. */
		groups: FileMatches[];
		total: number;
		hits: Hit[];
		activeHit: number;
		scanning: boolean;
		collapsed: Record<string, boolean>;
		includeOther?: boolean;
		/** What the scan refused to open (dependency trees, unreadable files). */
		skips?: SearchSkips;
		onincludeother?: (on: boolean) => void;
		ontogglegroup?: (id: string) => void;
		onsearchnext?: () => void;
		onsearchprev?: () => void;
		ongotoresult?: (i: number) => void;
		onreplacecurrent?: (replace: string) => void;
		onreplaceall?: (replace: string) => void;
	} = $props();

	const reduced = new MediaQuery("prefers-reduced-motion: reduce");
	let listEl = $state<HTMLElement>();
	let replaceEl = $state<HTMLInputElement>();

	const fileCount = $derived(groups.length);
	const isOpen = (group: FileMatches) => !collapsed[group.id];
	const skipNote = $derived(skipSummary(skips));

	/** Rows as rendered, so arrow keys and the active highlight agree. */
	const rows = $derived(
		groups.flatMap((group) =>
			isOpen(group)
				? group.matches.map((_, i) => ({ group, i }))
				: ([] as { group: FileMatches; i: number }[])
		)
	);
	/** Flat hit index for a rendered row, or -1 when its group is folded. */
	const hitIndexOf = (group: FileMatches, i: number) =>
		hits.findIndex((h) => h.fileId === group.id && h.match.from === group.matches[i].from);

	// Keep the active match on screen. The list can run to hundreds of rows, and
	// Enter-navigation would otherwise move an invisible highlight.
	$effect(() => {
		void activeHit;
		const el = listEl?.querySelector<HTMLElement>('[data-active="true"]');
		el?.scrollIntoView({ block: "nearest", behavior: reduced.current ? "auto" : "smooth" });
	});

	function onFindKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			if (e.shiftKey) onsearchprev?.();
			else onsearchnext?.();
			return;
		}
		if (e.key === "Escape") {
			e.preventDefault();
			store.clearSearchView();
		}
	}
	function onReplaceKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			// Shift+Enter is replace-all: the same relationship Enter/Shift+Enter has
			// in the find field, one level up in scope.
			if (e.shiftKey) onreplaceall?.(store.replace);
			else onreplacecurrent?.(store.replace);
			return;
		}
		if (e.key === "Escape") {
			e.preventDefault();
			store.searchInputEl?.focus();
		}
	}

	/** One tab stop for the whole list; arrows move between matches. */
	function onRowKeydown(e: KeyboardEvent, at: number) {
		const step =
			e.key === "ArrowDown"
				? 1
				: e.key === "ArrowUp"
					? -1
					: e.key === "Home"
						? -at
						: e.key === "End"
							? rows.length - 1 - at
							: null;
		if (step === null) return;
		e.preventDefault();
		const next = rows[Math.max(0, Math.min(rows.length - 1, at + step))];
		if (!next) return;
		const index = hitIndexOf(next.group, next.i);
		if (index !== -1) ongotoresult?.(index);
		listEl?.querySelectorAll<HTMLElement>("[data-row]")[at + step]?.focus();
	}

	// Autofocus the field when the Search view opens (e.g. via Shift+Ctrl/Cmd+F).
	$effect(() => {
		store.searchInputEl?.focus();
	});
</script>

<div class="flex flex-col gap-1 pt-0.5">
	<div class="flex items-start gap-0.5">
		<button
			class="{SEARCH_BTN} mt-0.5 shrink-0"
			title={store.showReplace ? 'Hide replace' : 'Toggle replace'}
			aria-label="Toggle replace"
			aria-expanded={store.showReplace}
			onclick={() => (store.showReplace = !store.showReplace)}
		>
			<IconChevronRight
				size={15}
				class="transition-transform duration-200 motion-reduce:transition-none {store.showReplace
					? 'rotate-90'
					: ''}"
			/>
		</button>

		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<div class="relative">
				<input
					bind:this={store.searchInputEl}
					bind:value={store.query}
					oninput={() => store.emitSearch()}
					onkeydown={onFindKeydown}
					class="{SEARCH_INPUT} w-full pr-[4.75rem] {result.error
						? 'border-destructive focus-visible:border-destructive'
						: ''}"
					placeholder="Find in project"
					aria-label="Find in project"
					aria-invalid={Boolean(result.error)}
					spellcheck="false"
				/>
				<div class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
					{#each store.findOptions as opt (opt.key)}
						<button
							class={searchPill(opt.on)}
							title={opt.title}
							aria-label={opt.title}
							aria-pressed={opt.on}
							onclick={opt.toggle}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			{#if store.showReplace}
				<div class="flex items-center gap-1">
					<div class="relative min-w-0 flex-1">
						<input
							bind:this={replaceEl}
							bind:value={store.replace}
							onkeydown={onReplaceKeydown}
							class="{SEARCH_INPUT} w-full pr-7"
							placeholder={store.useRegex ? 'Replace ($1, $&…)' : 'Replace'}
							aria-label="Replace with"
							spellcheck="false"
						/>
						<div class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
							<button
								class={searchPill(store.preserveCase)}
								title="Preserve case"
								aria-label="Preserve case"
								aria-pressed={store.preserveCase}
								onclick={() => store.togglePreserveCase()}
							>
								AB
							</button>
						</div>
					</div>
					<button
						class="{SEARCH_BTN} shrink-0"
						title="Replace this match (Enter)"
						aria-label="Replace this match"
						disabled={!hits.length}
						onclick={() => onreplacecurrent?.(store.replace)}
					>
						<IconReplace size={15} />
					</button>
					<button
						class="{SEARCH_BTN} shrink-0"
						title={fileCount > 1
							? `Replace all ${result.total} matches in ${fileCount} files (Shift+Enter)`
							: 'Replace all matches (Shift+Enter)'}
						aria-label="Replace all matches"
						disabled={!hits.length}
						onclick={() => onreplaceall?.(store.replace)}
					>
						<IconReplaceFilled size={15} />
					</button>
				</div>
			{/if}
		</div>
	</div>

	{#if result.error}
		<p
			class="text-destructive flex items-start gap-1.5 px-1.5 pt-1 text-xs"
			role="alert"
		>
			<IconAlertTriangle size={13} class="mt-px shrink-0" />
			<span>{result.error}</span>
		</p>
	{:else if store.query}
		<div class="flex items-center gap-1 px-0.5">
			<span class={SEARCH_COUNT}>
				{#if scanning}
					Searching…
				{:else if total}
					{activeHit + 1} of {total}
					{#if fileCount > 1}<span class="text-faint"> in {fileCount} files</span>{/if}
				{:else}
					No results
				{/if}
			</span>
			<button
				class="{SEARCH_BTN} ml-auto"
				title="Previous match (Shift+Enter)"
				aria-label="Previous match"
				disabled={!hits.length}
				onclick={() => onsearchprev?.()}
			>
				<IconChevronUp size={15} />
			</button>
			<button
				class={SEARCH_BTN}
				title="Next match (Enter)"
				aria-label="Next match"
				disabled={!hits.length}
				onclick={() => onsearchnext?.()}
			>
				<IconChevronDown size={15} />
			</button>
		</div>
	{/if}

	<!-- Excluded files are offered, never silently dropped: a search that quietly
	     skips half the project is indistinguishable from one that is broken. -->
	{#if !result.error && !scanning && result.otherTotal > 0}
		<button
			type="button"
			class="text-muted-foreground hover:bg-accent hover:text-foreground mt-0.5 flex h-7 w-full items-center gap-1.5 rounded-md px-1.5 text-left text-xs transition-colors"
			aria-pressed={includeOther}
			onclick={() => onincludeother?.(!includeOther)}
		>
			<IconFileOff size={13} class="text-faint shrink-0" />
			{#if includeOther}
				<span>Including {result.otherTotal} in generated and other files</span>
			{:else}
				<span>
					{result.otherTotal} more in generated and other files
				</span>
			{/if}
			<span class="text-brand ml-auto shrink-0 font-medium">{includeOther ? 'Hide' : 'Show'}</span>
		</button>
	{/if}

	<!-- Dependency trees have no opt-in: a single node_modules outweighs the project.
	     Saying so is the difference between "nothing matched" and "we didn't look". -->
	{#if !result.error && !scanning && store.query && skipNote}
		<p
			class="text-faint flex items-start gap-1.5 px-1.5 pt-1 text-xs"
			title={skips.vendorDirs.length > 2 ? skips.vendorDirs.join(', ') : undefined}
		>
			<IconFolderOff size={13} class="mt-px shrink-0" />
			<span>{skipNote}</span>
		</p>
	{/if}

	{#if !result.error && total}
		{@const activeKey = hits[activeHit]}
		<div bind:this={listEl} class="mt-1" role="listbox" aria-label="Search results" tabindex="-1">
			{#each groups as group (group.id)}
				{@const open = isOpen(group)}
				<button
					type="button"
					class="text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 w-full items-center gap-1 rounded-md px-1.5 text-left transition-colors"
					aria-expanded={open}
					onclick={() => ontogglegroup?.(group.id)}
				>
					<IconChevronRight
						size={13}
						class="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none {open
							? 'rotate-90'
							: ''}"
					/>
					<IconFileText size={14} class="shrink-0" />
					<span class="text-foreground min-w-0 flex-1 truncate text-sm font-medium"
						>{group.name}</span
					>
					{#if !isDocumentFile(group.name)}
						<span
							class="bg-muted text-faint shrink-0 rounded px-1 text-[10px] font-medium"
							title="Generated or non-document file"
						>
							other
						</span>
					{/if}
					<span class="text-faint shrink-0 text-xs tabular-nums">{group.matches.length}</span>
				</button>

				{#if open}
					{#each group.matches as m, i (m.from)}
						{@const index = hitIndexOf(group, i)}
						{@const on = activeKey && activeKey.fileId === group.id && activeKey.match.from === m.from}
						<button
							type="button"
							role="option"
							data-row
							data-active={on ? 'true' : undefined}
							aria-selected={on}
							tabindex={on ? 0 : -1}
							class="flex h-7 w-full items-center gap-1.5 rounded-md pr-2 pl-6 text-left transition-colors {on
								? 'bg-accent text-accent-foreground'
								: 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
							title={`${group.name}:${m.line}`}
							onkeydown={(e) => onRowKeydown(e, rows.findIndex((r) => r.group.id === group.id && r.i === i))}
							onclick={() => ongotoresult?.(index)}
						>
							<span
								class="text-faint w-9 shrink-0 text-right font-mono text-xs tabular-nums"
							>
								{m.line}
							</span>
							<span class="truncate font-mono text-xs">{m.text.trim() || ' '}</span>
						</button>
					{/each}
				{/if}
			{/each}

			{#if result.truncated}
				<p class="text-faint px-2 pt-1 text-xs">
					Stopped at {result.total} matches. Narrow the search to see the rest.
				</p>
			{/if}
		</div>
	{:else if !store.query}
		<p class="text-faint mt-1 px-1.5 text-xs">
			Find &amp; replace across every file in this project.
		</p>
	{/if}
</div>
