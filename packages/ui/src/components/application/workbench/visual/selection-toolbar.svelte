<script lang="ts">
	import { IconBold, IconCode, IconItalic, IconMath, IconLetterCase } from '@tabler/icons-svelte';

	/**
	 * Formatting bar over a live selection. Visual mode has no toolbar of its own,
	 * so without this the only way to bold a word is a keyboard shortcut nobody is
	 * told about.
	 *
	 * Every button suppresses mousedown: taking focus would collapse the selection
	 * it is about to act on.
	 */
	let { rect, oncommand }: { rect: DOMRect; oncommand: (id: string) => void } = $props();

	const ACTIONS = [
		{ id: 'bold', icon: IconBold, label: 'Bold', keys: 'Ctrl+B' },
		{ id: 'italic', icon: IconItalic, label: 'Italic', keys: 'Ctrl+I' },
		{ id: 'code', icon: IconCode, label: 'Monospace', keys: '' },
		{ id: 'smallcaps', icon: IconLetterCase, label: 'Small caps', keys: '' },
		{ id: 'math', icon: IconMath, label: 'Inline maths', keys: '' }
	];

	const WIDTH = 196;
	const left = $derived(
		Math.max(8, Math.min(rect.left + rect.width / 2 - WIDTH / 2, window.innerWidth - WIDTH - 8))
	);
	// Above the selection when there is room, below it when there is not.
	const top = $derived(rect.top > 56 ? rect.top - 44 : rect.bottom + 8);
</script>

<div
	class="border-border bg-popover fixed z-50 flex items-center gap-0.5 rounded-lg border p-1 shadow-lg"
	style:left="{left}px"
	style:top="{top}px"
	style:width="{WIDTH}px"
	role="toolbar"
	aria-label="Format selection"
>
	{#each ACTIONS as action (action.id)}
		{@const Icon = action.icon}
		<button
			type="button"
			title={action.keys ? `${action.label} (${action.keys})` : action.label}
			aria-label={action.label}
			class="text-muted-foreground hover:bg-accent hover:text-foreground flex size-9 items-center justify-center rounded-md transition-colors"
			onmousedown={(e) => e.preventDefault()}
			onclick={() => oncommand(action.id)}
		>
			<Icon size={16} />
		</button>
	{/each}
</div>
