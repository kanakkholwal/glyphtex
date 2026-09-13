<script lang="ts" module>
	import { createScene } from "./iso";

	const s = createScene();
	const SIZE = 150;
	const levels = [230, 115, 0];
	const slabs = levels.map((z) => s.box(0, 0, z, SIZE, SIZE, 22));
	const connectors = [
		[0, SIZE],
		[SIZE, SIZE],
		[SIZE, 0]
	].map(([x, y]) => s.tether([x, y, 230], [x, y, 22], 0));
	const viewBox = s.viewBox(16);
</script>

<script lang="ts">
	import "./iso.css";
	import Solid from "./Solid.svelte";

	let { class: className = "" }: { class?: string } = $props();
</script>

<svg
	{viewBox}
	class="iso block h-auto w-full {className}"
	role="img"
	aria-label="Three versions of a document stacked as layers, the newest on top marked with a check"
>
	{#each connectors as d (d)}
		<path class="dash" {d} />
	{/each}
	{#each slabs as b, i (levels[i])}
		<g class="float float-{i + 1}">
			<Solid {b}>
				<g class="decal" transform={s.plane(levels[i] + 22)}>
					<rect x="40" y="36" width="70" height="80" rx="6" />
					<path d="M54 54h32M54 66h42M54 78h26" />
					{#if i === 0}
						<path class="accent-line" d="M66 92l10 10 22-24" />
					{:else}
						<path d="M54 94h36" />
					{/if}
				</g>
			</Solid>
		</g>
	{/each}
</svg>
