<script lang="ts">
	import { cn } from '@glyphx/ui/utils';
	import type { Snippet } from 'svelte';

	// Width-constrained container with consistent horizontal padding. Single
	// source of truth for the marketing column widths so the sections line up
	// without each one redeclaring its own max-width.

	type Props = {
		children: Snippet;
		class?: string;
		size?: 'narrow' | 'default' | 'wide' | 'full';
	};

	let { children, class: className = '', size = 'default' }: Props = $props();

	const sizes = {
		narrow: 'max-w-3xl',
		default: 'max-w-6xl',
		wide: 'max-w-7xl',
		full: 'max-w-none'
	} as const;
</script>

<div class={cn('mx-auto w-full px-6 sm:px-8 lg:px-10', sizes[size], className)}>
	{@render children()}
</div>
