<script lang="ts">
	type Heading = { depth: number; text: string; id: string };
	type Props = { headings: readonly Heading[] };

	let { headings }: Props = $props();

	const items = $derived(headings.filter((h) => h.depth === 2 || h.depth === 3));

	let activeId = $state("");

	$effect(() => {
		if (items.length === 0) return;
		const nodes = items
			.map((item) => document.getElementById(item.id))
			.filter((node): node is HTMLElement => !!node);
		if (nodes.length === 0) return;

		// Top band only, so the highlight tracks the heading being read, not the centred one.
		const observer = new IntersectionObserver(
			(entries) => {
				const hit = entries.filter((entry) => entry.isIntersecting).at(0);
				if (hit) activeId = hit.target.id;
			},
			{ rootMargin: "-88px 0px -70% 0px", threshold: 0 }
		);
		for (const node of nodes) observer.observe(node);
		return () => observer.disconnect();
	});
</script>

{#if items.length > 2}
	<nav aria-label="On this page" class="flex flex-col">
		<p class="pb-2 text-caption font-medium text-muted-foreground">On this page</p>
		<ul class="flex flex-col border-l border-border">
			{#each items as item (item.id)}
				{@const active = activeId === item.id}
				<li>
					<a
						href="#{item.id}"
						aria-current={active ? "location" : undefined}
						class={[
							"-ml-px flex min-h-10 items-center border-l-2 py-1 pr-2 text-body outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
							item.depth === 3 ? "pl-6" : "pl-3",
							active
								? "border-primary font-medium text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground"
						]}
					>
						{item.text}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
