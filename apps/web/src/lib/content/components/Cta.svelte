<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import { Button } from "@glyphtex/ui/button";
	import { IconArrowRight } from "@tabler/icons-svelte";

	type Props = { title?: string; body?: string; label?: string; href?: string; from?: string };

	let {
		title = "Write it in the browser",
		body = "No account, no upload, no install. Your files stay on your machine.",
		label = "Open the workspace",
		href = "/workspace",
		from = "article"
	}: Props = $props();

	const resolveAny = resolve as (route: string) => string;
	const target = $derived(href.startsWith("/") ? resolveAny(href) : href);
</script>

<aside
	class="not-prose my-10 flex flex-col gap-5 rounded-2xl border border-hairline bg-surface-soft px-6 py-7 sm:flex-row sm:items-center sm:justify-between"
>
	<div>
		<p class="text-base font-semibold tracking-tight text-foreground">{title}</p>
		<p class="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
	</div>
	<Button href={target} class="shrink-0" onclick={() => track('cta_workspace_click', { from })}>
		{label}
		<IconArrowRight class="size-4" stroke-width={2} />
	</Button>
</aside>
