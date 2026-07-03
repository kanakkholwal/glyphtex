<script lang="ts" module>
	import type { Snippet } from "svelte";

	export interface SettingsSectionProps {
		/** Group title — rendered as the card header. Omit for a headerless card. */
		label?: string;
		/** Optional one-line note under the header title. */
		description?: string;
		/** Trailing content in the header (a Badge, a Refresh action…). */
		action?: Snippet;
		/** Draw hairlines between direct children — for row-list bodies. */
		divided?: boolean;
		/** Pad the body — for single-block bodies (row-list bodies pad each row). */
		padded?: boolean;
		/** Extra classes on the body. */
		class?: string;
		children: Snippet;
	}
</script>

<script lang="ts">
	import { cn } from "@glyphx/ui/utils";

	let {
		label,
		description,
		action,
		divided = false,
		padded = false,
		class: className,
		children,
	}: SettingsSectionProps = $props();
</script>

<!--
  SettingsSection — a titled setting-group. One elevated card owns the header
  (title + optional note + trailing action) and the body (rows or a block), so
  every settings page shares the same rhythm and the craft lives in one place.
-->
<section class="bg-card border-border shadow-craft-sm overflow-hidden rounded-2xl border" data-slot="settings-section">
	{#if label || description || action}
		<header class="border-border/60 flex items-center justify-between gap-3 border-b px-5 py-3.5">
			<div class="min-w-0">
				{#if label}
					<h3 class="text-foreground text-sm font-semibold tracking-tight">{label}</h3>
				{/if}
				{#if description}
					<p class="text-muted-foreground mt-0.5 text-xs leading-relaxed">{description}</p>
				{/if}
			</div>
			{#if action}<div class="shrink-0">{@render action()}</div>{/if}
		</header>
	{/if}
	<div class={cn(divided && "divide-border/60 divide-y", padded && "p-5", className)}>
		{@render children()}
	</div>
</section>
