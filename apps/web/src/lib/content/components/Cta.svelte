<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import Well from "$lib/site/Well.svelte";
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

<aside class="not-prose my-10">
	<Well bodyClass="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<p class="text-base font-medium text-foreground">{title}</p>
			<p class="mt-1 max-w-md text-sm text-pretty text-muted-foreground">{body}</p>
		</div>
		<Button
			variant="dark"
			size="sm"
			href={target}
			class="shrink-0"
			onclick={() => track('cta_clicked', { target: 'workspace', location: 'content', from })}
		>
			{label}
			<IconArrowRight />
		</Button>
	</Well>
</aside>
