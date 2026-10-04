<script lang="ts" module>
	export type FaqItem = { q: string; a: string };
</script>

<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import { IconChevronDown, IconPlus } from "@tabler/icons-svelte";
	import { Accordion } from "bits-ui";

	let {
		items,
		variant = "rules",
		onopen
	}: {
		items: FaqItem[];
		/** `cards`: numbered card per row. `rules`: hairline-divided rows. */
		variant?: "rules" | "cards";
		/** Called with the index of a panel as it opens. */
		onopen?: (index: number) => void;
	} = $props();

	let value = $state("0");
	const cards = $derived(variant === "cards");
</script>

<!-- bits-ui measures each panel, so height animates to its real size; one panel open at a time. -->
<Accordion.Root
	type="single"
	bind:value
	onValueChange={(v) => {
		if (v) onopen?.(Number(v));
	}}
	class={cards ? 'flex flex-col gap-2' : 'border-t border-dashed border-border'}
>
	{#each items as item, i (item.q)}
		<Accordion.Item
			value={String(i)}
			class={cards
				? 'panel-card px-4 sm:px-5'
				: 'border-b border-dashed border-border'}
		>
			<Accordion.Header level={3}>
				<Accordion.Trigger
					class="group flex min-h-14 w-full items-center justify-between gap-6 rounded-sm py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<span class="flex items-center gap-4">
						{#if cards}
							<span class="font-mono text-xs text-accent-ink tabular-nums" aria-hidden="true">
								{String(i + 1).padStart(2, '0')}
							</span>
						{/if}
						<span class={cn('font-medium text-foreground', cards ? 'text-base' : 'text-sm')}>
							{item.q}
						</span>
					</span>
					{#if cards}
						<IconChevronDown
							aria-hidden="true"
							class="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-base) ease-(--ease-out) group-data-[state=open]:rotate-180"
						/>
					{:else}
						<IconPlus
							aria-hidden="true"
							class="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-base) ease-(--ease-out) group-hover:text-foreground group-data-[state=open]:rotate-45"
						/>
					{/if}
				</Accordion.Trigger>
			</Accordion.Header>
			<Accordion.Content
				class="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
			>
				<p
					class={cn(
						'max-w-2xl pb-5 text-sm leading-relaxed text-pretty text-muted-foreground',
						cards && 'sm:pl-8'
					)}
				>
					{item.a}
				</p>
			</Accordion.Content>
		</Accordion.Item>
	{/each}
</Accordion.Root>
