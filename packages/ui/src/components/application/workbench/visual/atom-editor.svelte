<script lang="ts">
	import { untrack } from "svelte";

	import { Button } from "@glyphtex/ui/button";
	import { IconLinkOff, IconTrash } from "@tabler/icons-svelte";

	/** Edits one atom in place. These are the parts of a paragraph you can see but
	 *  could never type into. */
	let {
		target,
		onapply,
		onremove,
		onunlink,
		onclose
	}: {
		target: HTMLElement;
		onapply: (value: { src: string; url?: string }) => void;
		onremove: () => void;
		/** Drop the command but keep what it wrapped. */
		onunlink?: () => void;
		onclose: () => void;
	} = $props();

	const KINDS: Record<string, { title: string; hint: string }> = {
		math: { title: "Maths", hint: "LaTeX between the dollar signs" },
		cite: { title: "Citation", hint: "Comma-separated BibTeX keys" },
		ref: { title: "Cross-reference", hint: "The label it points at" },
		label: { title: "Anchor", hint: "The name other blocks reference" },
		link: { title: "Link", hint: "Shown text and its address" },
		footnote: { title: "Footnote", hint: "LaTeX, written back as typed" },
		comment: { title: "Comment", hint: "Kept in the source, never printed" },
		raw: { title: "Not modelled", hint: "Raw LaTeX, written back exactly" }
	};

	// Six symbols, matching the LaTeX toolbar's Math menu, so neither mode can do
	// something the other cannot.
	const SYMBOLS = [
		{ label: "a/b", insert: "\\frac{a}{b}" },
		{ label: "√", insert: "\\sqrt{x}" },
		{ label: "∑", insert: "\\sum_{i=1}^{n} " },
		{ label: "∏", insert: "\\prod_{i=1}^{n} " },
		{ label: "∫", insert: "\\int_{a}^{b} " },
		{ label: "lim", insert: "\\lim_{x \\to 0} " }
	];

	const kind = $derived(target.getAttribute("data-atom") ?? "raw");
	const meta = $derived(KINDS[kind] ?? KINDS.raw);
	const isLink = $derived(kind === "link");

	// Follows its atom rather than closing: the panel holds unapplied text, and a
	// stray wheel event used to throw it away.
	let scrolled = $state(0);
	$effect(() => {
		const bump = () => scrolled++;
		window.addEventListener("scroll", bump, true);
		return () => window.removeEventListener("scroll", bump, true);
	});
	const rect = $derived.by(() => {
		void scrolled;
		return target.getBoundingClientRect();
	});

	// Seeded once on open. The panel is keyed by the atom it edits, so a different
	// atom mounts a fresh instance rather than reusing this value.
	let value = $state(untrack(() => target.getAttribute("data-src") ?? ""));
	let url = $state(untrack(() => target.getAttribute("data-url") ?? ""));
	let input = $state<HTMLInputElement>();

	$effect(() => {
		input?.focus();
		input?.select();
	});

	function apply() {
		onapply(isLink ? { src: value, url } : { src: value });
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			event.preventDefault();
			apply();
		} else if (event.key === "Escape") {
			event.preventDefault();
			onclose();
		}
	}

	/** Drop a symbol in at the caret rather than at the end, so it can be built up
	 *  inside an existing expression. */
	function insertSymbol(text: string) {
		const at = input?.selectionStart ?? value.length;
		const to = input?.selectionEnd ?? at;
		value = value.slice(0, at) + text + value.slice(to);
		const caret = at + text.length;
		requestAnimationFrame(() => {
			input?.focus();
			input?.setSelectionRange(caret, caret);
		});
	}

	const height = $derived(132 + (isLink ? 38 : 0) + (kind === "math" ? 34 : 0));
	const top = $derived(
		rect.bottom + height > window.innerHeight ? rect.top - height - 6 : rect.bottom + 6
	);
	const FIELD =
		"border-border text-foreground focus-visible:border-brand w-full rounded-md border bg-transparent px-2 py-1.5 font-mono text-sm outline-none";
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

	{#if kind === 'math'}
		<div class="mb-1.5 flex items-center gap-0.5" role="group" aria-label="Insert a symbol">
			{#each SYMBOLS as symbol (symbol.label)}
				<button
					type="button"
					title={symbol.insert}
					class="text-muted-foreground hover:bg-accent hover:text-foreground h-7 min-w-8 rounded px-1.5 font-mono text-xs"
					onclick={() => insertSymbol(symbol.insert)}
				>
					{symbol.label}
				</button>
			{/each}
		</div>
	{/if}

	<input
		bind:this={input}
		bind:value
		onkeydown={onKeyDown}
		aria-label={isLink ? 'Link text' : `${meta.title} source`}
		placeholder={isLink ? 'Text to show' : ''}
		class={FIELD}
	/>
	{#if isLink}
		<input
			bind:value={url}
			onkeydown={onKeyDown}
			aria-label="Link address"
			placeholder="https://example.com"
			class="{FIELD} mt-1.5"
		/>
	{/if}

	<div class="mt-2.5 flex items-center gap-1">
		<Button size="sm" class="mr-1 h-8" onclick={apply}>Apply</Button>
		<Button size="sm" variant="ghost" class="h-8" onclick={onclose}>Cancel</Button>
		{#if isLink && onunlink}
			<Button
				size="sm"
				variant="ghost"
				title="Remove the link, keep the text"
				class="text-muted-foreground hover:text-foreground ml-auto h-8 gap-1.5 px-2"
				onclick={onunlink}
			>
				<IconLinkOff size={14} />
				Unlink
			</Button>
		{/if}
		<Button
			size="sm"
			variant="ghost"
			title={isLink ? 'Delete the link and its text' : 'Delete'}
			class="text-muted-foreground hover:text-destructive h-8 gap-1.5 px-2 {isLink && onunlink
				? ''
				: 'ml-auto'}"
			onclick={onremove}
		>
			<IconTrash size={14} />
			Delete
		</Button>
	</div>
</div>
