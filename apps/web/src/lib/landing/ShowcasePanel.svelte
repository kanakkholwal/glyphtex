<script lang="ts">
	import { cn } from '@glyphx/ui/utils';
	import type { Snippet } from 'svelte';

	// Full-bleed showcase panel. A softly tinted rounded card that holds the
	// section's visual + text composition. Each section picks a tone so the
	// landing reads as a sequence of distinct showcases rather than one
	// continuous scroller. Tones are deliberately near-neutral so they support
	// the brand blue and the dark canvas without competing.

	type Props = {
		children: Snippet;
		class?: string;
		tone?: 'blue' | 'green' | 'yellow' | 'violet' | 'neutral';
		padding?: 'default' | 'tight' | 'loose';
	};

	let { children, class: className = '', tone = 'neutral', padding = 'default' }: Props = $props();

	// Tones are a hint of color over the page bg, not a solid wash. Light
	// mode sits at 30% so the wash is felt, not seen; dark mode pulls to 12%
	// because the dark canvas already absorbs the hue.
	const toneClass: Record<NonNullable<Props['tone']>, string> = {
		blue: 'bg-blue-50/30 dark:bg-blue-950/12',
		green: 'bg-emerald-50/30 dark:bg-emerald-950/12',
		yellow: 'bg-amber-50/30 dark:bg-amber-950/12',
		violet: 'bg-violet-50/30 dark:bg-violet-950/12',
		neutral: 'bg-foreground/[0.02] dark:bg-foreground/[0.03]'
	};

	const paddingClass: Record<NonNullable<Props['padding']>, string> = {
		tight: 'p-6 sm:p-9 md:p-12',
		default: 'p-6 sm:p-12 md:p-16 lg:p-20',
		loose: 'p-8 sm:p-14 md:p-20 lg:p-24'
	};
</script>

<div
	class={cn(
		'relative overflow-hidden rounded-[2.25rem]',
		toneClass[tone],
		paddingClass[padding],
		className
	)}
>
	{@render children()}
</div>
