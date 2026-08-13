<script lang="ts">
	import type { WorkbenchController } from './controller.svelte';
	import EditorTabs from './editor-tabs.svelte';

	/** Open files, and nothing else. Layout, export and compile are page-global, so
	 *  they moved up to the title bar and its menus: this row is now only "which
	 *  file am I looking at", which is what a tab strip is for. */
	let { ctrl }: { ctrl: WorkbenchController } = $props();

	const files = $derived(ctrl.files);
</script>

<!-- Recessed in light, where card and canvas are both white and the active tab
     would have nothing to sit against. Dark already has the lift. -->
<div class="border-border bg-muted dark:bg-card flex h-9 shrink-0 items-stretch border-b">
	<EditorTabs {files} onnew={() => files.newFile()} />
</div>
