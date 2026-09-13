<script lang="ts">
	type Props = { code?: string; caption?: string };

	let { code = "", caption = "" }: Props = $props();

	let svg = $state("");
	let failed = $state(false);
	let host = $state<HTMLElement | null>(null);

	const uid = $props.id();
	const id = `mmd-${uid}`;

	// mermaid is ~500 KB: imported only once a diagram nears the viewport.
	async function render(dark: boolean) {
		const { default: mermaid } = await import("mermaid");
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: "strict",
			theme: dark ? "dark" : "neutral",
			fontFamily: "inherit",
			flowchart: { curve: "basis", padding: 18 }
		});
		try {
			const out = await mermaid.render(`${id}-${dark ? "d" : "l"}`, code);
			svg = out.svg;
			failed = false;
		} catch {
			failed = true;
		}
	}

	$effect(() => {
		if (!host) return;
		const root = document.documentElement;
		let started = false;
		const draw = () => render(root.classList.contains("dark"));

		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting) || started) return;
				started = true;
				io.disconnect();
				draw();
			},
			{ rootMargin: "300px" }
		);
		io.observe(host);

		// Re-render on theme toggle, but only after the first draw.
		const mo = new MutationObserver(() => {
			if (started) draw();
		});
		mo.observe(root, { attributes: true, attributeFilter: ["class"] });

		return () => {
			io.disconnect();
			mo.disconnect();
		};
	});
</script>

<figure class="not-prose my-9" bind:this={host}>
	<div
		class="panel-card overflow-x-auto px-4 py-6 text-center [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
	>
		{#if svg}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html svg}
		{:else}
			<!-- Also the prerendered payload, so the diagram is readable without JS. -->
			<pre
				class="m-0 overflow-x-auto text-left font-mono text-caption text-muted-foreground">{code}</pre>
		{/if}
	</div>
	{#if caption}
		<figcaption class="mt-3 text-center text-body text-muted-foreground">{caption}</figcaption>
	{/if}
	{#if failed}
		<figcaption class="mt-2 text-center text-caption text-destructive">
			<span class="font-semibold">Error:</span> the diagram could not be drawn, so its source is shown.
		</figcaption>
	{/if}
</figure>
