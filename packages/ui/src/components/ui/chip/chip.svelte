<script lang="ts">
	import { CRAFT_FOCUS_RING, cn } from "@glyphtex/ui/utils";
	import { IconCheck, IconX } from "@tabler/icons-svelte";

	/** Filter/tag pill: a toggle with `onclick`, a link with `href`, static otherwise, or `removable`.
	 *  `color` renders a leading dot; `selected` adds a check so state is not colour alone. */
	let {
		label,
		color = null,
		selected = false,
		removable = false,
		href,
		onclick,
		onremove,
		class: className
	}: {
		label: string;
		color?: string | null;
		selected?: boolean;
		removable?: boolean;
		href?: string;
		onclick?: () => void;
		onremove?: () => void;
		class?: string;
	} = $props();

	const base =
		"inline-flex w-fit max-w-full shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors";
	const tone = $derived(
		selected
			? "border-primary bg-primary/10 text-foreground"
			: "border-border bg-muted text-muted-foreground hover:border-border-strong hover:text-foreground"
	);
</script>

{#snippet body()}
	{#if selected}
		<IconCheck class="text-primary size-3 shrink-0" aria-hidden="true" />
	{/if}
	{#if color}
		<span class="size-2 shrink-0 rounded-full" style:background={color}></span>
	{/if}
	<span class="truncate">{label}</span>
{/snippet}

{#if removable}
	<div data-slot="chip" class={cn(base, tone, className)}>
		{@render body()}
		<button
			type="button"
			aria-label={`Remove ${label}`}
			onclick={onremove}
			class={cn(
				CRAFT_FOCUS_RING,
				'-mr-1 ml-0.5 grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground'
			)}
		>
			<IconX class="size-3" />
		</button>
	</div>
{:else if onclick}
	<button
		type="button"
		data-slot="chip"
		aria-pressed={selected}
		{onclick}
		class={cn(CRAFT_FOCUS_RING, base, tone, className)}
	>
		{@render body()}
	</button>
{:else if href}
	<a
		data-slot="chip"
		{href}
		aria-current={selected ? 'page' : undefined}
		class={cn(CRAFT_FOCUS_RING, base, tone, className)}
	>
		{@render body()}
	</a>
{:else}
	<!-- Static: callers often wrap chips in their own link, and a button inside an anchor is invalid. -->
	<span data-slot="chip" class={cn(base, tone, className)}>
		{@render body()}
	</span>
{/if}
