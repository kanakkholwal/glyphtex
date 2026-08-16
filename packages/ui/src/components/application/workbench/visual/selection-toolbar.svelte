<script lang="ts">
	import {
		IconBold,
		IconCode,
		IconDots,
		IconItalic,
		IconLink,
		IconLinkOff,
		IconMath,
		IconUnderline
	} from "@tabler/icons-svelte";

	/** Formatting bar over a live selection. Mousedown is suppressed throughout:
	 *  taking focus would collapse the selection it is about to act on. */
	let { rect, oncommand }: { rect: DOMRect; oncommand: (id: string) => void } = $props();

	const GROUPS = [
		[
			{ id: "bold", icon: IconBold, label: "Bold", keys: "Ctrl+B" },
			{ id: "italic", icon: IconItalic, label: "Italic", keys: "Ctrl+I" },
			{ id: "underline", icon: IconUnderline, label: "Underline", keys: "Ctrl+U" }
		],
		[
			{ id: "code", icon: IconCode, label: "Monospace", keys: "" },
			{ id: "math", icon: IconMath, label: "Inline maths", keys: "" }
		]
	];

	const MORE = [
		{ id: "smallcaps", label: "Small caps", hint: "\\textsc" },
		{ id: "emph", label: "Emphasis", hint: "\\emph" },
		{ id: "strike", label: "Strikethrough", hint: "\\sout" },
		{ id: "sans", label: "Sans serif", hint: "\\textsf" },
		{ id: "superscript", label: "Superscript", hint: "\\textsuperscript" },
		{ id: "subscript", label: "Subscript", hint: "\\textsubscript" },
		{ id: "clear", label: "Clear formatting", hint: "" }
	];

	// The browser knows about the marks it applies itself; ours are on the DOM.
	const NATIVE: Record<string, string> = {
		bold: "bold",
		italic: "italic",
		underline: "underline",
		strike: "strikeThrough",
		superscript: "superscript",
		subscript: "subscript"
	};

	/** Recomputed whenever the rect changes, which is once per selection. */
	const active = $derived.by(() => {
		void rect;
		const on = new Set<string>();
		for (const [id, command] of Object.entries(NATIVE)) {
			try {
				if (document.queryCommandState(command)) on.add(id);
			} catch {
				// Firefox throws for a command it does not know; the DOM walk covers it.
			}
		}
		const selection = document.getSelection();
		let node: Node | null = selection?.anchorNode ?? null;
		let host: Element | null = null;
		while (node && node !== document.body) {
			const element = node as Element;
			const mark = element.getAttribute?.("data-mark");
			if (mark) on.add(mark);
			if (element.getAttribute?.("data-atom") === "link") on.add("link");
			if (element.hasAttribute?.("data-block-editor")) host = element;
			node = element.parentNode;
		}
		// A selection dragged over a link starts in the text before it, so the walk
		// up from the anchor never reaches the atom.
		if (host && selection?.rangeCount) {
			const range = selection.getRangeAt(0);
			for (const link of host.querySelectorAll('[data-atom="link"]'))
				if (range.intersectsNode(link)) on.add("link");
		}
		return on;
	});

	let more = $state(false);

	// Seven 26px controls, two hairline separators, the border and the padding.
	const WIDTH = 214;
	const left = $derived(
		Math.max(8, Math.min(rect.left + rect.width / 2 - WIDTH / 2, window.innerWidth - WIDTH - 8))
	);
	// Above the selection when there is room, below it when there is not.
	const top = $derived(rect.top > 48 ? rect.top - 38 : rect.bottom + 8);

	const BUTTON =
		"flex size-[26px] items-center justify-center rounded transition-colors hover:bg-accent hover:text-foreground";

	function run(id: string) {
		more = false;
		oncommand(id);
	}
</script>

<div
	class="border-border bg-popover fixed z-50 flex items-center rounded-md border p-0.5 shadow-md"
	style:left="{left}px"
	style:top="{top}px"
	style:width="{WIDTH}px"
	role="toolbar"
	tabindex="-1"
	aria-label="Format selection"
	onmousedown={(e) => e.preventDefault()}
>
	{#each GROUPS as group, g (g)}
		{#if g > 0}<span class="bg-border/70 mx-0.5 h-4 w-px" aria-hidden="true"></span>{/if}
		{#each group as action (action.id)}
			{@const Icon = action.icon}
			<button
				type="button"
				title={action.keys ? `${action.label} (${action.keys})` : action.label}
				aria-label={action.label}
				aria-pressed={active.has(action.id)}
				class="{BUTTON} {active.has(action.id)
					? 'bg-accent text-foreground'
					: 'text-muted-foreground'}"
				onclick={() => run(action.id)}
			>
				<Icon size={15} />
			</button>
		{/each}
	{/each}

	<span class="bg-border/70 mx-0.5 h-4 w-px" aria-hidden="true"></span>
	{#if active.has('link')}
		<button
			type="button"
			title="Remove link"
			aria-label="Remove link"
			class="{BUTTON} text-muted-foreground"
			onclick={() => run('unlink')}
		>
			<IconLinkOff size={15} />
		</button>
	{:else}
		<button
			type="button"
			title="Link"
			aria-label="Link"
			class="{BUTTON} text-muted-foreground"
			onclick={() => run('link')}
		>
			<IconLink size={15} />
		</button>
	{/if}

	<span class="bg-border/70 mx-0.5 h-4 w-px" aria-hidden="true"></span>
	<button
		type="button"
		title="More formatting"
		aria-label="More formatting"
		aria-expanded={more}
		class="{BUTTON} {more ? 'bg-accent text-foreground' : 'text-muted-foreground'}"
		onclick={() => (more = !more)}
	>
		<IconDots size={15} />
	</button>

	{#if more}
		<div
			class="border-border bg-popover absolute top-full right-0 z-50 mt-1 w-52 rounded-lg border p-1 shadow-lg"
			role="menu"
			aria-label="More formatting"
		>
			{#each MORE as item (item.id)}
				<button
					type="button"
					role="menuitemcheckbox"
					aria-checked={active.has(item.id)}
					class="hover:bg-accent hover:text-foreground flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[0.8125rem] {active.has(
						item.id
					)
						? 'bg-accent/60 text-foreground'
						: 'text-muted-foreground'}"
					onclick={() => run(item.id)}
				>
					<span class="flex-1">{item.label}</span>
					{#if item.hint}<span class="text-faint font-mono text-[0.6875rem]">{item.hint}</span>{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
