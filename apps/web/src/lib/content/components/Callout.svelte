<script lang="ts">
	import { IconAlertTriangle, IconBulb, IconInfoCircle } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";

	type Kind = "note" | "tip" | "warn";
	type Props = { type?: Kind; title?: string; children?: Snippet };

	let { type = "note", title, children }: Props = $props();

	const styles = {
		note: {
			icon: IconInfoCircle,
			ring: "border-info/35",
			tint: "bg-info/6",
			mark: "text-info",
			label: "Note"
		},
		tip: {
			icon: IconBulb,
			ring: "border-success/35",
			tint: "bg-success/6",
			mark: "text-success",
			label: "Tip"
		},
		warn: {
			icon: IconAlertTriangle,
			ring: "border-warning/40",
			tint: "bg-warning/8",
			mark: "text-warning",
			label: "Careful"
		}
	} as const;

	const style = $derived(styles[type as Kind] ?? styles.note);
	const Icon = $derived(style.icon);
</script>

<aside class="not-prose my-7 rounded-xl border {style.ring} {style.tint} px-5 py-4">
	<p class="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
		<Icon class="size-4 {style.mark}" stroke-width={2} />
		{title ?? style.label}
	</p>
	<div
		class="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground [&_a]:underline [&_a]:underline-offset-2 [&_code]:text-foreground [&>p]:m-0 [&>p+p]:mt-3"
	>
		{@render children?.()}
	</div>
</aside>
