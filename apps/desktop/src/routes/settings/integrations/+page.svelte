<script lang="ts">
	import { Badge } from '@glyphx/ui/badge';
	import { Button } from '@glyphx/ui/button';
	import { SettingsField } from '@glyphx/ui/settings-field';
	import { Spinner } from '@glyphx/ui/spinner';
	import { toast } from '@glyphx/ui/sonner';
	import { IconCheck, IconCloud } from '@tabler/icons-svelte';
	import { projectHost } from '$lib/project';

	// Inline button state so the action gives feedback (idle → busy → done)
	// rather than silently firing a toast that's easy to miss.
	let addStatus = $state<'idle' | 'busy' | 'done'>('idle');

	async function addShellIntegration() {
		if (addStatus === 'busy') return;
		addStatus = 'busy';
		try {
			const msg = await projectHost.registerShellIntegration?.();
			addStatus = 'done';
			toast.success(msg ?? 'Added “Open with GlyphX” to the folder menu.');
		} catch (e) {
			addStatus = 'idle';
			toast.error(`Could not register shell integration — ${e}`);
		}
	}
</script>

<div class="flex max-w-2xl flex-col gap-8">
	<header>
		<h2 class="font-display text-xl font-semibold tracking-tight">Integrations</h2>
		<p class="text-muted-foreground mt-1.5 text-sm">
			OS integration and (later) cloud sync. The LaTeX engine lives under Engine.
		</p>
	</header>

	<section class="flex flex-col gap-2.5">
		<h3 class="text-muted-foreground px-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
			System
		</h3>
		<div class="bg-card border-border rounded-xl border">
			<div class="px-4 py-3.5">
				<SettingsField
					label="Shell integration"
					description={addStatus === 'done'
						? 'Added — right-click any folder and choose “Open with GlyphX”.'
						: 'Add an “Open with GlyphX” entry to the folder right-click menu. (.tex and .glyx files are associated by the installer.)'}
					layout="row"
				>
					<Button
						variant={addStatus === 'done' ? 'success_soft' : 'outline'}
						size="sm"
						disabled={addStatus === 'busy'}
						onclick={addShellIntegration}
					>
						{#if addStatus === 'busy'}
							<Spinner class="size-3.5" /> Adding…
						{:else if addStatus === 'done'}
							<IconCheck size={15} /> Added
						{:else}
							Add to menu
						{/if}
					</Button>
				</SettingsField>
			</div>
		</div>
	</section>

	<section class="flex flex-col gap-2.5">
		<div class="flex items-center gap-2 px-1">
			<h3 class="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
				Cloud sync
			</h3>
			<Badge variant="secondary">Coming soon</Badge>
		</div>
		<div
			class="bg-card border-border text-muted-foreground flex items-center gap-3 rounded-xl border px-4 py-5 text-sm"
		>
			<IconCloud size={20} class="shrink-0 opacity-70" />
			<p class="leading-relaxed">
				Optional end-to-end encrypted sync across your devices. GlyphX stays local-first — this will
				always be opt-in.
			</p>
		</div>
	</section>
</div>
