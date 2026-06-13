<script lang="ts" module>
	export type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

	const MARK_PX: Record<LogoSize, number> = { sm: 20, md: 24, lg: 44, xl: 72 };
	const TEXT_CLS: Record<LogoSize, string> = {
		sm: 'text-sm',
		md: 'text-base',
		lg: 'text-2xl',
		xl: 'text-4xl'
	};
</script>

<script lang="ts">
	import { cn } from '@glyph/ui/utils';

	/**
	 * Logo — the Glyph brand lockup: a geometric "G" glyph mark plus an optional
	 * wordmark. Reusable everywhere (top bar, empty states, marketing).
	 *
	 * - `badge` (default) sets the mark in a filled rounded-square; turn it off
	 *   for a plain currentColor mark (large display / on-dark).
	 * - `text={false}` renders the mark alone.
	 * - `size` is a preset or a raw pixel height for the mark.
	 */
	let {
		text = true,
		badge = true,
		size = 'md',
		href,
		class: className = ''
	}: {
		text?: boolean;
		badge?: boolean;
		size?: LogoSize | number;
		href?: string;
		class?: string;
	} = $props();

	const px = $derived(typeof size === 'number' ? size : MARK_PX[size]);
	// Presets carry their own wordmark size; a raw px size lets the wordmark
	// inherit whatever text size the caller passes via `class`.
	const textCls = $derived(typeof size === 'number' ? '' : TEXT_CLS[size]);
</script>

{#snippet glyph(s: number)}
	<svg
		width={s}
		height={s}
		viewBox="0 0 24 24"
		fill="none"
		aria-hidden="true"
		role="presentation"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<!-- A written page: document with a folded corner + lines of text. -->
		<path d="M13.5 3H7.5A2 2 0 0 0 5.5 5V19A2 2 0 0 0 7.5 21H16.5A2 2 0 0 0 18.5 19V8L13.5 3Z" />
		<path d="M13.5 3V8H18.5" />
		<path d="M9 12.75H15" />
		<path d="M9 16H13" />
	</svg>
{/snippet}

<svelte:element
	this={href ? 'a' : 'span'}
	{href}
	class={cn('inline-flex shrink-0 items-center gap-2', className)}
	aria-label="Glyph"
>
	{#if badge}
		<span
			class="bg-primary text-primary-foreground grid shrink-0 place-items-center rounded-[28%]"
			style:width={`${px}px`}
			style:height={`${px}px`}
		>
			{@render glyph(px * 0.6)}
		</span>
	{:else}
		<span
			class="text-foreground grid shrink-0 place-items-center"
			style:width={`${px}px`}
			style:height={`${px}px`}
		>
			{@render glyph(px)}
		</span>
	{/if}

	{#if text}
		<span class={cn('font-display font-semibold leading-none tracking-tight', textCls)}>Glyph</span>
	{/if}
</svelte:element>
