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

		// Top band only, so the highlight tracks the heading you are reading under
		// rather than whichever one happens to be centred.
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
	<nav aria-label="On this page" class="text-sm">
		<p class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
			On this page
		</p>
		<ul class="mt-4 space-y-2.5 border-l border-hairline">
			{#each items as item (item.id)}
				<li>
					<a
						href="#{item.id}"
						class={[
							"-ml-px block border-l py-0.5 leading-snug transition-colors",
							item.depth === 3 ? "pl-7" : "pl-4",
							activeId === item.id
								? "border-foreground text-foreground"
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
