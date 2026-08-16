<script lang="ts">
	import { cn } from "@glyphtex/ui/utils";
	import type { Snippet } from "svelte";

	type Props = {
		children: Snippet;
		class?: string;
		id?: string;
		spacing?: "tight" | "default" | "loose" | "none";
		bordered?: boolean;
	};

	let {
		children,
		class: className = "",
		id,
		spacing = "default",
		bordered = false
	}: Props = $props();

	const spacings = {
		none: "",
		tight: "py-14 md:py-20",
		default: "py-20 md:py-28",
		loose: "py-28 md:py-40"
	} as const;
</script>

<section
	{id}
	class={cn(
		'relative w-full',
		spacings[spacing],
		bordered && 'border-t border-hairline',
		className
	)}
>
	{@render children()}
</section>
