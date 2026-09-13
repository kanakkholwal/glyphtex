<script lang="ts">
	import type { Snippet } from "svelte";
	import type { BoxFaces } from "./iso";

	let {
		b,
		accent = false,
		accentTop = false,
		children
	}: {
		b: BoxFaces;
		/** Whole solid in the brand colour. */
		accent?: boolean;
		/** Only the top face in the brand colour. */
		accentTop?: boolean;
		children?: Snippet;
	} = $props();
</script>

<g class="solid">
	<polygon class={accent ? 'accent-side' : 'face-left'} points={b.left} />
	<polygon class={accent ? 'accent-side' : 'face-right'} points={b.right} />
	<polygon class={accent || accentTop ? 'accent-top' : 'face-top'} points={b.top} />
	{@render children?.()}
</g>
