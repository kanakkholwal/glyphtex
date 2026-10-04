<script lang="ts">
	// `items` is pipe-separated pairs: "3 s :: Cold compile | 0 :: Servers touched".
	// Directive attributes are plain strings, so this avoids quoting JSON in markdown.
	type Props = { items?: string; source?: string };

	let { items = "", source = "" }: Props = $props();

	const parsed = $derived(
		items
			.split("|")
			.map((pair) => pair.split("::").map((part) => part.trim()))
			.filter((pair) => pair.length === 2 && pair[0])
			.map(([value, label]) => ({ value, label }))
	);

	// Spelled out so Tailwind's scanner sees every class it must generate.
	const columns: Record<number, string> = {
		1: "sm:grid-cols-1",
		2: "sm:grid-cols-2",
		3: "sm:grid-cols-3",
		4: "sm:grid-cols-4"
	};
	const gridCols = $derived(columns[Math.min(parsed.length, 4)] ?? "sm:grid-cols-3");
</script>

{#if parsed.length}
	<dl class="not-prose my-9 grid gap-x-8 {gridCols}">
		{#each parsed as stat (stat.label)}
			<div class="flex flex-col border-t border-dashed border-border py-4">
				<dt class="order-2 mt-1 text-sm text-muted-foreground">{stat.label}</dt>
				<dd class="pixel order-1 text-2xl text-foreground tabular-nums">{stat.value}</dd>
			</div>
		{/each}
	</dl>
	{#if source}
		<p class="not-prose -mt-6 mb-9 font-mono text-xs text-muted-foreground">{source}</p>
	{/if}
{/if}
