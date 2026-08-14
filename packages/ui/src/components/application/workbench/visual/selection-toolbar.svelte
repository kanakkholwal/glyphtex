<script lang="ts">
	import {
		IconBold,
		IconCode,
		IconDots,
		IconItalic,
		IconLink,
		IconMath
	} from '@tabler/icons-svelte';

	/**
	 * Formatting bar over a live selection. Visual mode has no toolbar of its own,
	 * so without this the only way to bold a word is a keyboard shortcut nobody is
	 * told about. The five everyday marks are direct; the rest sit behind the
	 * overflow, so the bar stays a glance rather than a menu.
	 *
	 * Every control suppresses mousedown: taking focus would collapse the
	 * selection it is about to act on.
	 */
	let { rect, oncommand }: { rect: DOMRect; oncommand: (id: string) => void } = $props();

	const ACTIONS = [
		{ id: 'bold', icon: IconBold, label: 'Bold', keys: 'Ctrl+B' },
		{ id: 'italic', icon: IconItalic, label: 'Italic', keys: 'Ctrl+I' },
		{ id: 'code', icon: IconCode, label: 'Monospace', keys: '' },
		{ id: 'link', icon: IconLink, label: 'Link', keys: '' },
		{ id: 'math', icon: IconMath, label: 'Inline maths', keys: '' }
	];

	const MORE = [
		{ id: 'smallcaps', label: 'Small caps', hint: '\\textsc' },
		{ id: 'emph', label: 'Emphasis', hint: '\\emph' },
		{ id: 'underline', label: 'Underline', hint: '\\underline' },
		{ id: 'strike', label: 'Strikethrough', hint: '\\sout' },
		{ id: 'sans', label: 'Sans serif', hint: '\\textsf' },
		{ id: 'superscript', label: 'Superscript', hint: '\\textsuperscript' },
		{ id: 'subscript', label: 'Subscript', hint: '\\textsubscript' },
		{ id: 'clear', label: 'Clear formatting', hint: '' }
	];

	let more = $state(false);

	// Six 26px controls plus the 1px border and 2px padding either side.
	const WIDTH = 162;
	const left = $derived(
		Math.max(8, Math.min(rect.left + rect.width / 2 - WIDTH / 2, window.innerWidth - WIDTH - 8))
	);
	// Above the selection when there is room, below it when there is not.
	const top = $derived(rect.top > 48 ? rect.top - 38 : rect.bottom + 8);

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
	{#each ACTIONS as action (action.id)}
		{@const Icon = action.icon}
		<button
			type="button"
			title={action.keys ? `${action.label} (${action.keys})` : action.label}
			aria-label={action.label}
			class="text-muted-foreground hover:bg-accent hover:text-foreground flex size-[26px] items-center justify-center rounded transition-colors"
			onclick={() => run(action.id)}
		>
			<Icon size={15} />
		</button>
	{/each}

	<span class="bg-border/70 mx-0.5 h-4 w-px" aria-hidden="true"></span>
	<button
		type="button"
		title="More formatting"
		aria-label="More formatting"
		aria-expanded={more}
		class="text-muted-foreground hover:bg-accent hover:text-foreground flex size-[26px] items-center justify-center rounded transition-colors {more
			? 'bg-accent text-foreground'
			: ''}"
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
					role="menuitem"
					class="text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[0.8125rem]"
					onclick={() => run(item.id)}
				>
					<span class="flex-1">{item.label}</span>
					{#if item.hint}<span class="text-faint font-mono text-[0.6875rem]">{item.hint}</span>{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
