<script lang="ts">
	import { IconAlertTriangle, IconBulb, IconInfoCircle } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";

	type Kind = "note" | "tip" | "warn";
	type Props = { type?: Kind; title?: string; children?: Snippet };

	let { type = "note", title, children }: Props = $props();

	const styles = {
		note: { icon: IconInfoCircle, mark: "text-muted-foreground", label: "Note" },
		tip: { icon: IconBulb, mark: "text-muted-foreground", label: "Tip" },
		warn: { icon: IconAlertTriangle, mark: "text-warning-strong", label: "Careful" }
	} as const;

	const style = $derived(styles[type as Kind] ?? styles.note);
	const Icon = $derived(style.icon);
</script>

<aside class="not-prose my-7 flex gap-3 rounded-xl bg-card px-5 py-4">
	<Icon class="mt-0.5 size-4 shrink-0 {style.mark}" aria-hidden="true" />
	<div class="min-w-0">
		<p class={["text-sm font-medium", type === "warn" ? style.mark : "text-foreground"]}>
			{title ?? style.label}
		</p>
		<div
			class="mt-1 text-sm text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_code]:font-mono [&_code]:text-foreground [&>p]:m-0 [&>p+p]:mt-3"
		>
			{@render children?.()}
		</div>
	</div>
</aside>
