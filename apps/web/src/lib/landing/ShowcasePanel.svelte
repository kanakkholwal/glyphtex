<script lang="ts">
	import { cn } from '@glyphtex/ui/utils';
	import type { Snippet } from 'svelte';

	// Notion's bento surface: a flat tinted block, no border, no shadow. Product
	// imagery is meant to bleed past the bottom edge, so the panel clips.

	type Props = {
		children: Snippet;
		class?: string;
		tone?: 'soft' | 'plain';
		padding?: 'default' | 'tight' | 'loose' | 'none';
	};

	let { children, class: className = '', tone = 'soft', padding = 'default' }: Props = $props();

	const toneClass = {
		soft: 'bg-surface-soft',
		plain: 'bg-transparent'
	} as const;

	const paddingClass = {
		none: '',
		tight: 'p-6 sm:p-8',
		default: 'p-6 sm:p-10 md:p-12',
		loose: 'p-8 sm:p-14 md:p-20'
	} as const;
</script>

<div
	class={cn(
		'relative overflow-hidden rounded-3xl',
		toneClass[tone],
		paddingClass[padding],
		className
	)}
>
	{@render children()}
</div>
