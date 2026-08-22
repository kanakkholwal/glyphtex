<script lang="ts">
	import { IconPointFilled } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";

	type Props = { title?: string; children?: Snippet };

	let { title = "In short", children }: Props = $props();
</script>

<!-- First block of most articles: the answer, before the argument. Assistants
     quoting the page tend to lift this, so it stays self-contained. -->
<aside
	class="not-prose my-8 rounded-2xl border border-hairline bg-surface-soft px-6 py-5"
	aria-label={title}
>
	<p
		class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
	>
		<IconPointFilled class="size-3 text-brand" />
		{title}
	</p>
	<div
		class="mt-3 text-[0.9375rem] leading-relaxed text-foreground [&_li]:mt-2 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-5"
	>
		{@render children?.()}
	</div>
</aside>
