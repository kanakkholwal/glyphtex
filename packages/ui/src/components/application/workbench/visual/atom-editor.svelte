<script lang="ts">
	import { untrack } from 'svelte';

	import { Button } from '@glyphtex/ui/button';
	import { IconTrash } from '@tabler/icons-svelte';

	/**
	 * Edits one atom in place: the maths, the citation keys, the ref target. These
	 * are the parts of a paragraph you can see in visual mode but could never type
	 * into, so without this they are read-only holes in an editable document.
	 */
	let {
		target,
		onapply,
		onremove,
		onclose
	}: {
		target: HTMLElement;
		onapply: (source: string) => void;
		onremove: () => void;
		onclose: () => void;
	} = $props();

	const KINDS: Record<string, { title: string; hint: string; mono: boolean }> = {
		math: { title: 'Maths', hint: 'LaTeX between the dollar signs', mono: true },
		cite: { title: 'Citation', hint: 'Comma-separated BibTeX keys', mono: true },
		ref: { title: 'Cross-reference', hint: 'The label it points at', mono: true },
		label: { title: 'Anchor', hint: 'The name other blocks reference', mono: true },
		raw: { title: 'Not modelled', hint: 'Raw LaTeX, written back exactly', mono: true }
	};

	const kind = $derived(target.getAttribute('data-atom') ?? 'raw');
	const meta = $derived(KINDS[kind] ?? KINDS.raw);
	const rect = $derived(target.getBoundingClientRect());

	// Seeded once on open. The panel is keyed by the atom it edits, so a different
	// atom mounts a fresh instance rather than reusing this value.
	let value = $state(untrack(() => target.getAttribute('data-src') ?? ''));
	let input = $state<HTMLInputElement>();

	$effect(() => {
		input?.focus();
		input?.select();
	});

	function apply() {
		onapply(value);
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			apply();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			onclose();
		}
	}

	const PANEL_H = 132;
	const top = $derived(
		rect.bottom + PANEL_H > window.innerHeight ? rect.top - PANEL_H - 6 : rect.bottom + 6
	);
</script>

<svelte:window onresize={onclose} />

<div class="fixed inset-0 z-40" role="presentation" onpointerdown={onclose}></div>

<div
	class="border-border bg-popover fixed z-50 w-80 rounded-lg border p-3 shadow-lg"
	style:left="{Math.max(8, Math.min(rect.left, window.innerWidth - 336))}px"
	style:top="{Math.max(8, top)}px"
	role="dialog"
	aria-label="Edit {meta.title.toLowerCase()}"
>
	<div class="mb-2 flex items-baseline justify-between gap-2">
		<span class="text-foreground text-sm font-medium">{meta.title}</span>
		<span class="text-faint text-xs">{meta.hint}</span>
	</div>
	<input
		bind:this={input}
		bind:value
		onkeydown={onKeyDown}
		aria-label="{meta.title} source"
		class="border-border text-foreground focus-visible:border-brand w-full rounded-md border bg-transparent px-2 py-1.5 text-sm outline-none {meta.mono
			? 'font-mono'
			: ''}"
	/>
	<div class="mt-2.5 flex items-center gap-2">
		<Button size="sm" class="h-8" onclick={apply}>Apply</Button>
		<Button size="sm" variant="ghost" class="h-8" onclick={onclose}>Cancel</Button>
		<Button
			size="sm"
			variant="ghost"
			class="text-muted-foreground hover:text-destructive ml-auto h-8 gap-1.5 px-2"
			onclick={onremove}
		>
			<IconTrash size={14} />
			Remove
		</Button>
	</div>
</div>
