<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";

	/** A lowercase label in curly braces above a heading, e.g. `{open in glyphtex}`. */
	let { label, class: className }: { label: string; class?: string } = $props();
</script>

<p class={cn("pixel text-accent-ink text-sm lowercase", className)}>
	<span aria-hidden="true">{"{"}</span>{label}<span aria-hidden="true">{"}"}</span>
</p>
