<script lang="ts">
	import { IconArrowDown, IconArrowUp, IconGitBranch } from '@tabler/icons-svelte';

	import type { GitHeadInfo } from '../git-panel.svelte';

	/** Branch state at the foot of the panel: the one place it is always visible. */
	let { head, onopen }: { head?: GitHeadInfo | null; onopen?: () => void } = $props();

	const ahead = $derived(head?.ahead ?? 0);
	const behind = $derived(head?.behind ?? 0);
</script>

{#if head}
	<button
		class="border-border text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 shrink-0 items-center gap-1.5 border-t px-3 text-xs transition-colors"
		title="Open Source Control"
		onclick={() => onopen?.()}
	>
		<IconGitBranch size={13} class="shrink-0" />
		<span class="min-w-0 truncate">
			{head.branch ?? 'HEAD'}{head.unborn ? ' (no commits)' : ''}
		</span>
		<span class="ml-auto flex shrink-0 items-center gap-1 tabular-nums">
			<span class="inline-flex items-center"><IconArrowDown size={12} />{behind}</span>
			<span class="inline-flex items-center"><IconArrowUp size={12} />{ahead}</span>
		</span>
	</button>
{/if}
