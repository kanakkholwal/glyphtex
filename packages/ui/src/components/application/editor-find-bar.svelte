<script lang="ts" module>
	export type FindBarOptions = {
		query: string;
		replace?: string;
		caseSensitive?: boolean;
		wholeWord?: boolean;
		regexp?: boolean;
		preserveCase?: boolean;
	};
</script>

<script lang="ts">
	import { IconChevronDown, IconChevronRight, IconChevronUp, IconReplace, IconX } from '@glyphx/ui/icons';
	import { SEARCH_BTN, SEARCH_COUNT, SEARCH_INPUT, searchPill } from './search-ui';

	/**
	 * EditorFindBar — a sticky find/replace bar that docks at the bottom of the
	 * editor pane (VS Code's bottom-widget language). Self-contained input state;
	 * emits the full option set to the host via `onsearch`, and the host drives
	 * the CodeEditor's findAll / replace API. Mirrors the side-panel Search view's
	 * chrome (the Aa / W / .* pill toggles) so the two stay visually consistent.
	 */
	let {
		resultCount = 0,
		activeIndex = 0,
		initial,
		onsearch,
		onnext,
		onprev,
		onreplacecurrent,
		onreplaceall,
		onclose
	}: {
		resultCount?: number;
		activeIndex?: number;
		/** Seed the fields when the bar opens (e.g. from the current selection). */
		initial?: FindBarOptions;
		onsearch?: (o: FindBarOptions) => void;
		onnext?: () => void;
		onprev?: () => void;
		onreplacecurrent?: (replace: string) => void;
		onreplaceall?: (replace: string) => void;
		onclose?: () => void;
	} = $props();

	let query = $derived(initial?.query ?? '');
	let replace = $derived(initial?.replace ?? '');
	let matchCase = $derived(initial?.caseSensitive ?? false);
	let wholeWord = $derived(initial?.wholeWord ?? false);
	let useRegex = $derived(initial?.regexp ?? false);
	let preserveCase = $derived(initial?.preserveCase ?? false);
	let showReplace = $state(false);
	let findInputEl = $state<HTMLInputElement>();

	export function focusInput() {
		findInputEl?.focus();
		findInputEl?.select();
	}

	function emit() {
		onsearch?.({ query, replace, caseSensitive: matchCase, wholeWord, regexp: useRegex, preserveCase });
	}

	const toggles = $derived([
		{ key: 'case', label: 'Aa', title: 'Match case', on: matchCase, toggle: () => { matchCase = !matchCase; emit(); } },
		{ key: 'word', label: 'W', title: 'Whole word', on: wholeWord, toggle: () => { wholeWord = !wholeWord; emit(); } },
		{ key: 'regex', label: '.*', title: 'Regular expression', on: useRegex, toggle: () => { useRegex = !useRegex; emit(); } }
	]);

	function onFindKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (e.shiftKey) onprev?.();
			else onnext?.();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onclose?.();
		}
	}
</script>

<div
	class="bg-card border-border flex shrink-0 items-start gap-2 border-t px-2 py-1.5"
	role="search"
	aria-label="Find in document"
>
	<!-- Expand/collapse the replace row (VS Code parity). -->
	<button
		class="{SEARCH_BTN} mt-0.5 shrink-0"
		title={showReplace ? 'Hide replace' : 'Toggle replace'}
		aria-label="Toggle replace"
		aria-expanded={showReplace}
		onclick={() => (showReplace = !showReplace)}
	>
		<IconChevronRight size={15} class="transition-transform duration-200 {showReplace ? 'rotate-90' : ''}" />
	</button>

	<div class="flex min-w-0 flex-1 flex-col gap-1">
		<!-- Find row -->
		<div class="flex items-center gap-1">
			<div class="relative min-w-0 flex-1">
				<input
					bind:this={findInputEl}
					bind:value={query}
					oninput={emit}
					onkeydown={onFindKeydown}
					class="{SEARCH_INPUT} w-full pr-[4.75rem]"
					placeholder="Find"
					aria-label="Find"
					spellcheck="false"
				/>
				<div class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
					{#each toggles as opt (opt.key)}
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

			<span class="{SEARCH_COUNT} w-20 shrink-0 text-center">
				{#if query && resultCount}
					{activeIndex + 1} of {resultCount}
				{:else if query}
					No results
				{/if}
			</span>

			<button
				class="{SEARCH_BTN} shrink-0"
				title="Previous match (Shift+Enter)"
				aria-label="Previous match"
				disabled={!resultCount}
				onclick={() => onprev?.()}
			>
				<IconChevronUp size={15} />
			</button>
			<button
				class="{SEARCH_BTN} shrink-0"
				title="Next match (Enter)"
				aria-label="Next match"
				disabled={!resultCount}
				onclick={() => onnext?.()}
			>
				<IconChevronDown size={15} />
			</button>
			<button
				class="{SEARCH_BTN} shrink-0"
				title="Close (Esc)"
				aria-label="Close find"
				onclick={() => onclose?.()}
			>
				<IconX size={15} />
			</button>
		</div>

		<!-- Replace row -->
		{#if showReplace}
			<div class="flex items-center gap-1">
				<div class="relative min-w-0 flex-1">
					<input
						bind:value={replace}
						class="{SEARCH_INPUT} w-full pr-7"
						placeholder={useRegex ? 'Replace ($1, $&…)' : 'Replace'}
						aria-label="Replace with"
						spellcheck="false"
					/>
					<div class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
						<button
							class={searchPill(preserveCase)}
							title="Preserve case"
							aria-label="Preserve case"
							aria-pressed={preserveCase}
							onclick={() => {
								preserveCase = !preserveCase;
								emit();
							}}
						>
							AB
						</button>
					</div>
				</div>
				<button
					class="{SEARCH_BTN} shrink-0"
					title="Replace next match"
					aria-label="Replace next match"
					disabled={!resultCount}
					onclick={() => onreplacecurrent?.(replace)}
				>
					<IconReplace size={15} />
				</button>
				<button
					class="text-muted-foreground hover:bg-muted hover:text-foreground border-border h-7 shrink-0 rounded border px-2 text-xs transition-colors disabled:opacity-40"
					title="Replace all matches"
					aria-label="Replace all matches"
					disabled={!resultCount}
					onclick={() => onreplaceall?.(replace)}
				>
					All
				</button>
			</div>
		{/if}
	</div>
</div>
