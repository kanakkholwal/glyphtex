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
	class="not-prose panel-card my-10 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between"
>
	<div>
		<p class="text-body-lg font-medium text-foreground">{title}</p>
		<p class="mt-1 max-w-md text-pretty text-body text-muted-foreground">{body}</p>
	</div>
	<Button
		href={target}
		class="shrink-0"
		onclick={() => track('cta_clicked', { target: 'workspace', location: 'content', from })}
	>
		{label}
		<IconArrowRight />
	</Button>
</aside>
