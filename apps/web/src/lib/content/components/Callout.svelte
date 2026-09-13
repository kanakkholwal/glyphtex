<script lang="ts">
	import { IconAlertTriangle, IconBulb, IconInfoCircle } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";

	type Kind = "note" | "tip" | "warn";
	type Props = { type?: Kind; title?: string; children?: Snippet };

	let { type = "note", title, children }: Props = $props();

	const styles = {
		note: {
			icon: IconInfoCircle,
			box: "border-info/35 bg-info/5",
			mark: "text-info",
			label: "Note"
		},
		tip: {
			icon: IconBulb,
			box: "border-success/35 bg-success/5",
			mark: "text-success",
			label: "Tip"
		},
		warn: {
			icon: IconAlertTriangle,
			box: "border-warning/40 bg-warning/5",
			mark: "text-warning",
			label: "Careful"
		}
	} as const;

	const style = $derived(styles[type as Kind] ?? styles.note);
	const Icon = $derived(style.icon);
</script>

<aside class="not-prose my-7 rounded-xl border px-5 py-4 {style.box}">
	<p class="flex items-center gap-2 text-body font-semibold text-foreground">
		<Icon class="size-4 {style.mark}" aria-hidden="true" />
		{title ?? style.label}
	</p>
	<div
		class="mt-2 text-body text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_code]:text-foreground [&>p]:m-0 [&>p+p]:mt-3"
	>
		{@render children?.()}
	</div>
</aside>
