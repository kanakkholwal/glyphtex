<script lang="ts">
	import { IconChevronRight } from "@tabler/icons-svelte";

	import type { GitPanelStore } from "./store.svelte";
	import type { SectionKey } from "./types";

	// Collapsible section header; action buttons are siblings in the parent's flex row.
	let {
		store,
		title,
		sectionKey,
		count = null
	}: {
		store: GitPanelStore;
		title: string;
		sectionKey: SectionKey;
		count?: number | null;
	} = $props();
</script>

<button
	class="text-muted-foreground hover:text-foreground flex min-w-0 flex-1 items-center gap-1 rounded text-xs font-semibold tracking-wide uppercase transition-colors"
	aria-expanded={store.sections[sectionKey]}
	onclick={() => store.toggleSection(sectionKey)}
>
	<IconChevronRight
		size={12}
		class="shrink-0 transition-transform duration-200 ease-craft {store
			.sections[sectionKey]
			? 'rotate-90'
			: ''}"
	/>
	<span class="truncate">{title}{count != null ? ` (${count})` : ''}</span>
</button>
