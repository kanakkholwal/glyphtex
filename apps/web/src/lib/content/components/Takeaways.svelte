<script lang="ts">
	import type { Snippet } from "svelte";

	type Props = { title?: string; children?: Snippet };

	let { title = "In short", children }: Props = $props();
</script>

<!-- The answer before the argument; assistants quoting the page lift this, so keep it self-contained. -->
<aside class="not-prose panel-card my-8 px-6 py-5" aria-label={title}>
	<p class="text-caption font-semibold text-primary">{title}</p>
	<div
		class="mt-2 text-body-lg text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_li]:mt-2 [&_li]:pl-1 [&_li::marker]:text-primary [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-5"
	>
		{@render children?.()}
	</div>
</aside>
