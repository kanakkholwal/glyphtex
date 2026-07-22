<script lang="ts">
	import { cn } from '@glyphtex/ui/utils';
	import type { Snippet } from 'svelte';

	// Vertical-rhythm wrapper for every landing section. `border-t` + a
	// hairline border gives each section a clear seam without needing
	// background colors that fight the editorial backdrop photo. Sections
	// opt in to a border by passing `bordered`.

	type Props = {
		children: Snippet;
		class?: string;
		id?: string;
		spacing?: 'tight' | 'default' | 'loose' | 'none';
		bordered?: boolean;
	};

	let {
		children,
		class: className = '',
		id,
		spacing = 'default',
		bordered = false
	}: Props = $props();

	const spacings = {
		none: '',
		tight: 'py-16 md:py-20',
		default: 'py-24 md:py-32',
		loose: 'py-32 md:py-44'
	} as const;
</script>

<section
	{id}
	class={cn(
		'relative w-full',
		spacings[spacing],
		bordered && 'border-t border-hairline/70',
		className
	)}
>
	{@render children()}
</section>
