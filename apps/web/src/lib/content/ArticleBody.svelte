<script lang="ts">
	import { registry } from "virtual:docvia/source/browser";
	import DocviaRenderer from "./DocviaRenderer.svelte";
	import { proseClass } from "./prose";

	// `content` is the rendered node tree from the server load. The registry is
	// pulled from the browser (lazy) module so the eager page map never ships.
	let { content }: { content: unknown } = $props();
</script>

<div class={proseClass}>
	<DocviaRenderer nodes={content as never} {registry} />
</div>
