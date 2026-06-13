<script lang="ts" module>
	export type PaletteFile = { id: string; name: string };
</script>

<script lang="ts">
	import {
		IconChevronDown,
		IconCornerDownLeft,
		IconFile,
		IconSearch,
		IconStack2
	} from '@tabler/icons-svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	/**
	 * CommandPalette — the centre of the top bar. Shows the workspace name as a
	 * VS Code-style pill; clicking it (or ⌘/Ctrl+P) opens a quick-open overlay to
	 * jump between files. Built to grow into a multi-workspace switcher later.
	 */
	let {
		open = $bindable(false),
		files = [],
		activeId = '',
		projectName = 'Project',
		onopen
	}: {
		open?: boolean;
		files?: PaletteFile[];
		activeId?: string;
		projectName?: string;
		onopen?: (id: string) => void;
	} = $props();

	let query = $state('');
	let inputEl = $state<HTMLInputElement>();
	let cursor = $state(0);

	const filtered = $derived(
		files.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()))
	);

	$effect(() => {
		if (open) {
			cursor = 0;
			queueMicrotask(() => inputEl?.focus());
		} else {
			query = '';
		}
	});

	// Keep the highlighted row in range as the filter narrows.
	$effect(() => {
		if (cursor > filtered.length - 1) cursor = Math.max(0, filtered.length - 1);
	});

	function choose(id: string) {
		onopen?.(id);
		open = false;
	}

	function onInputKey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			cursor = Math.min(filtered.length - 1, cursor + 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			cursor = Math.max(0, cursor - 1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const hit = filtered[cursor];
			if (hit) choose(hit.id);
		} else if (e.key === 'Escape') {
			open = false;
		}
	}

	// Split a path into folder / file so the overlay reads like an explorer.
	function parts(name: string) {
		const i = name.lastIndexOf('/');
		return i === -1
			? { dir: '', base: name }
			: { dir: name.slice(0, i + 1), base: name.slice(i + 1) };
	}
</script>

<!-- Centre trigger: the workspace name (VS Code's command-centre slot). -->
<button
	class="text-muted-foreground hover:bg-muted/60 hover:text-foreground border-border/60 bg-muted/30 flex h-7 w-72 max-w-[40vw] items-center justify-center gap-2 rounded-md border px-3 text-[13px] transition-colors"
	title="Search files (⌘/Ctrl+P)"
	aria-haspopup="dialog"
	onclick={() => (open = true)}
>
	<IconStack2 size={14} class="shrink-0 opacity-70" />
	<span class="text-foreground truncate font-medium">{projectName}</span>
	<IconChevronDown size={13} class="shrink-0 opacity-50" />
</button>

{#if open}
	<div class="fixed inset-0 z-[100]">
		<!-- Scrim -->
		<button
			class="absolute inset-0 cursor-default bg-black/20"
			aria-label="Close search"
			tabindex="-1"
			onclick={() => (open = false)}
		></button>

		<div
			class="border-border bg-popover/80 shadow-craft-floating absolute top-14 left-1/2 w-[34rem] max-w-[92vw] -translate-x-1/2 overflow-hidden rounded-xl border backdrop-blur-xl"
			role="dialog"
			aria-label="Quick open"
			transition:fly={{ y: -8, duration: 160, easing: cubicOut }}
		>
			<div class="border-border/70 flex items-center gap-2 border-b px-3">
				<IconSearch size={16} class="text-muted-foreground shrink-0" />
				<input
					bind:this={inputEl}
					bind:value={query}
					onkeydown={onInputKey}
					class="text-foreground placeholder:text-muted-foreground h-11 w-full bg-transparent text-sm outline-none"
					placeholder="Go to file by name…"
					spellcheck="false"
					aria-label="Go to file"
				/>
			</div>

			<div class="max-h-80 overflow-auto p-1.5">
				<div
					class="text-muted-foreground/70 px-2 pt-1 pb-1.5 text-[11px] font-medium tracking-wider uppercase"
				>
					{projectName}
				</div>
				{#if filtered.length === 0}
					<p class="text-muted-foreground px-2 py-6 text-center text-sm">No matching files</p>
				{:else}
					{#each filtered as f, i (f.id)}
						{@const p = parts(f.name)}
						<button
							class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors {i ===
							cursor
								? 'bg-muted'
								: 'hover:bg-muted/60'}"
							role="option"
							aria-selected={i === cursor}
							onmouseenter={() => (cursor = i)}
							onclick={() => choose(f.id)}
						>
							<IconFile size={15} class="text-muted-foreground shrink-0" />
							<span class="text-foreground truncate">{p.base}</span>
							{#if p.dir}<span class="text-muted-foreground/60 truncate text-xs">{p.dir}</span>{/if}
							{#if f.id === activeId}
								<span class="text-muted-foreground/50 ml-auto text-[11px]">open</span>
							{/if}
							{#if i === cursor}
								<IconCornerDownLeft
									size={13}
									class="text-muted-foreground/50 {f.id === activeId ? 'ml-1.5' : 'ml-auto'}"
								/>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
