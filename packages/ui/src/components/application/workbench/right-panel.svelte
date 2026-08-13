<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import { IconTrash, IconX } from '@tabler/icons-svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	import SettingsView from '../side-panel/settings-view.svelte';
	import type { WorkbenchController } from './controller.svelte';
	import NotesPanel from './notes-panel.svelte';

	/** Notes and Settings, overlaid on the right edge. Both are consulted and
	 *  dismissed; docking either one made opening it reflow the editor and PDF. */
	let { ctrl }: { ctrl: WorkbenchController } = $props();

	const layout = $derived(ctrl.layout);
	const files = $derived(ctrl.files);

	const title = $derived(layout.rightPanel === 'notes' ? 'Notes' : 'Settings');

	let shellStatus = $state<'idle' | 'busy' | 'done'>('idle');
	const canRegisterShell = $derived(Boolean(files.project?.registerShellIntegration));

	async function addShellIntegration() {
		if (shellStatus === 'busy') return;
		shellStatus = 'busy';
		shellStatus = (await files.registerShell()) ? 'done' : 'idle';
	}
</script>

<!-- Escape closes it; there is no scrim, because the panes underneath stay usable
     while the panel is open. -->
<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && layout.rightPanel !== 'none') layout.rightPanel = 'none';
	}}
/>

{#if layout.rightPanel !== 'none'}
	<aside
		class="border-border bg-sidebar shadow-craft-lg absolute inset-y-0 right-0 z-30 flex w-[340px] max-w-[85vw] flex-col border-l"
		aria-label={title}
		transition:fly={{ x: 24, duration: 200, easing: cubicOut }}
	>
		<header class="border-border flex h-11 shrink-0 items-center gap-2 border-b px-3">
			<h2 class="text-foreground truncate text-sm font-medium">{title}</h2>
			{#if layout.rightPanel === 'notes' && ctrl.notes.openCount}
				<span class="text-faint text-xs tabular-nums">{ctrl.notes.openCount} open</span>
			{/if}
			<div class="flex-1"></div>
			{#if layout.rightPanel === 'notes' && ctrl.notes.doneCount}
				<Button
					variant="ghost"
					size="icon-sm"
					title="Clear {ctrl.notes.doneCount} completed"
					aria-label="Clear completed notes"
					onclick={() => ctrl.notes.clearDone()}
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

		{#if layout.rightPanel === 'notes'}
			<NotesPanel notes={ctrl.notes} chromeless />
		{:else}
			<div class="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3 text-sm">
				<SettingsView
					engine={ctrl.engine}
					hasShellIntegration={canRegisterShell}
					{shellStatus}
					onaddshell={addShellIntegration}
				/>
			</div>
		{/if}
	</aside>
{/if}
