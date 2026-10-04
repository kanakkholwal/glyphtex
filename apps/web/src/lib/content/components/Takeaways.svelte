<script lang="ts">
	import { IconListCheck } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";

	type Props = { title?: string; children?: Snippet };

	let { title = "In short", children }: Props = $props();
</script>

<!-- The answer before the argument; assistants quoting the page lift this, so keep it self-contained. -->
<aside class="not-prose my-8 rounded-xl bg-card px-5 py-4 sm:px-6 sm:py-5" aria-label={title}>
	<p class="flex items-center gap-2 font-mono text-xs text-muted-foreground">
		<IconListCheck class="size-4" aria-hidden="true" />
		{title}
	</p>
	<div
		class="mt-3 text-base text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_li]:mt-2 [&_li]:pl-1 [&_li::marker]:text-muted-foreground [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-5"
	>
		{@render children?.()}
	</div>
</aside>
