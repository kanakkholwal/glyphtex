<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { IconTrash, IconX } from "@tabler/icons-svelte";

	import SettingsView from "../side-panel/settings-view.svelte";
	import type { WorkbenchController } from "./controller.svelte";
	import NotesPanel from "./notes-panel.svelte";

	/** Notes and Settings share one docked column on the right edge, in both
	 *  editors. Two rail entries and two layout columns became one of each. */
	let { ctrl }: { ctrl: WorkbenchController } = $props();

	const layout = $derived(ctrl.layout);
	const files = $derived(ctrl.files);
	const notes = $derived(ctrl.notes);

	const open = $derived(layout.rightPanel !== "none");
	const title = $derived(layout.rightPanel === "notes" ? "Notes" : "Settings");

	let shellStatus = $state<"idle" | "busy" | "done">("idle");
	const canRegisterShell = $derived(Boolean(files.project?.registerShellIntegration));

	async function addShellIntegration() {
		if (shellStatus === "busy") return;
		shellStatus = "busy";
		shellStatus = (await files.registerShell()) ? "done" : "idle";
	}

	const WIDTH_PX = 320;
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && open) layout.rightPanel = 'none';
	}}
/>

<!-- Collapses by width so scroll and the draft note survive a toggle; the inner
     box holds the real width so content doesn't reflow mid-animation. -->
<div
	class="shrink-0 overflow-hidden transition-[width] duration-300 ease-craft motion-reduce:transition-none {open
		? ''
		: 'pointer-events-none'}"
	style:width={open ? `${WIDTH_PX}px` : '0px'}
	aria-hidden={!open}
>
	<aside
		class="border-border bg-sidebar flex h-full min-h-0 flex-col border-l"
		style:width={`${WIDTH_PX}px`}
		aria-label={title}
	>
		<header class="border-border flex h-9 shrink-0 items-center gap-2 border-b px-2 pl-3">
			<h2 class="text-foreground truncate text-xs font-medium">{title}</h2>
			{#if layout.rightPanel === 'notes' && notes.openCount}
				<span class="text-muted-foreground text-xs tabular-nums">{notes.openCount} open</span>
			{/if}
			<div class="flex-1"></div>
			{#if layout.rightPanel === 'notes' && notes.doneCount}
				<Button
					variant="ghost"
					size="icon-sm"
					title="Clear {notes.doneCount} completed"
					aria-label="Clear completed notes"
					onclick={() => notes.clearDone()}
				>
					<IconTrash />
				</Button>
			{/if}
			<Button
				variant="ghost"
				size="icon-sm"
				title="Close"
				aria-label="Close {title}"
				onclick={() => (layout.rightPanel = 'none')}
			>
				<IconX />
			</Button>
		</header>

		{#if layout.rightPanel === 'settings'}
			<div class="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3 text-sm">
				<SettingsView
					engine={ctrl.engine}
					hasShellIntegration={canRegisterShell}
					{shellStatus}
					onaddshell={addShellIntegration}
				/>
			</div>
		{:else}
			<NotesPanel {notes} chromeless />
		{/if}
	</aside>
</div>
