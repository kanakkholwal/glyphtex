<script lang="ts">
	import { cn } from '@glyphtex/ui/utils';
	import type { Snippet } from 'svelte';

	// macOS-style window chrome (traffic lights + titlebar). Shared across the
	// hero preview, the editor mock, and the comparison slider so the visual
	// language stays consistent. `url` renders a browser-style origin crumb
	// (the hero uses it); omit it for plain app windows.

	type Props = {
		title?: string;
		url?: string;
		class?: string;
		children: Snippet;
		// Traffic lights tint red/amber/green on hover (a small macOS touch).
		// On by default; the parent owns the `group/win` selector via this root.
		hoverLights?: boolean;
	};

	let { title, url, class: className = '', children, hoverLights = true }: Props = $props();

	const lights = [
		{ hover: 'group-hover/win:bg-destructive/70' },
		{ hover: 'group-hover/win:bg-warning/70' },
		{ hover: 'group-hover/win:bg-success/70' }
	];
</script>

<div class={cn('landing-glass-card group/win relative overflow-hidden rounded-2xl', className)}>
	<div
		class="flex h-10 items-center gap-2 border-b border-hairline/40 bg-white/5 px-4 dark:bg-white/3"
	>
		<div class="flex gap-1.5">
			{#each lights as light, i (i)}
				<span
					class={cn(
						'size-2.5 rounded-full bg-foreground/15',
						hoverLights && `transition-colors ${light.hover}`
					)}
				></span>
			{/each}
		</div>
		{#if url || title}
			<div class="ml-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
				{#if url}
					<span class="hidden sm:inline">{url}</span>
				{/if}
				{#if url && title}
					<span class="hidden sm:inline">·</span>
				{/if}
				{#if title}
					<span>{title}</span>
				{/if}
			</div>
		{/if}
	</div>
	{@render children()}
</div>
