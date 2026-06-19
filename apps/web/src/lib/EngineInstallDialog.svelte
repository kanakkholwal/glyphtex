<script lang="ts">
	import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@glyphx/ui/dialog';
	import { Button } from '@glyphx/ui/button';
	import { Checkbox } from '@glyphx/ui/checkbox';
	import { IconCpu, IconLoader2, IconAlertTriangle } from '@tabler/icons-svelte';
	import { installEngine, type InstallProgress } from '$lib/compile';
	import { PACKAGE_GROUPS, CORE_APPROX_MB, estimateMB } from '$lib/engine-packages';

	/**
	 * First-run gate for the in-browser LaTeX compiler. The engine + TeX files
	 * download once and are cached by the service worker (persistently, across
	 * deploys), so this only appears until the user installs. Required install —
	 * there's no dismiss; compiling stays gated behind it.
	 */
	let { open = $bindable(false), ondone }: { open?: boolean; ondone?: () => void } = $props();

	// All groups selected by default — "all are needed", but the user can trim.
	let selected = $state<Record<string, boolean>>(
		Object.fromEntries(PACKAGE_GROUPS.map((g) => [g.id, true]))
	);
	const selectedIds = $derived(PACKAGE_GROUPS.filter((g) => selected[g.id]).map((g) => g.id));
	const totalMB = $derived(estimateMB(selectedIds));

	let installing = $state(false);
	let progress = $state<InstallProgress | undefined>(undefined);
	let error = $state<string | undefined>(undefined);

	const pct = $derived(
		progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
	);

	async function start() {
		installing = true;
		error = undefined;
		progress = { done: 0, total: selectedIds.length + 2, label: 'Preparing…' };
		try {
			await installEngine(selectedIds, (p) => (progress = p));
			open = false;
			ondone?.();
		} catch (e) {
			error =
				'Could not download the compiler. Check your internet connection and try again. ' +
				`(${String(e)})`;
		} finally {
			installing = false;
		}
	}

	// Required install: every user-initiated dismiss path is disabled on
	// <DialogContent> below (no close button, outside-click + Esc ignored), so the
	// dialog only closes when `start()` sets `open = false` on success.
</script>

<Dialog bind:open>
	<DialogContent
		showCloseButton={false}
		interactOutsideBehavior="ignore"
		escapeKeydownBehavior="ignore"
		class="sm:max-w-md"
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<IconCpu size={18} class="text-primary" />
				Set up the LaTeX compiler
			</DialogTitle>
			<DialogDescription class="leading-relaxed">
				GlyphX compiles LaTeX right in your browser. The engine and TeX files download once
				(~{totalMB} MB) and are cached for offline use — pick what to include below.
			</DialogDescription>
		</DialogHeader>

		<div class="flex flex-col gap-2">
			<!-- Core: always installed, locked on. -->
			<div class="border-border bg-muted/40 flex items-start gap-2.5 rounded-lg border p-2.5">
				<Checkbox checked disabled aria-label="Core compiler (required)" class="mt-0.5" />
				<div class="min-w-0 flex-1">
					<div class="flex items-center justify-between gap-2">
						<span class="text-foreground text-sm font-medium">Core compiler</span>
						<span class="text-muted-foreground shrink-0 text-xs tabular-nums">~{CORE_APPROX_MB} MB</span>
					</div>
					<p class="text-muted-foreground text-xs">
						LaTeX engine (WebAssembly) + TeX format & base files. Required.
					</p>
				</div>
			</div>

			<!-- Optional, toggleable package groups. -->
			{#each PACKAGE_GROUPS as g (g.id)}
				<label
					class="border-border hover:bg-muted/40 flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors"
				>
					<Checkbox bind:checked={selected[g.id]} disabled={installing} class="mt-0.5" />
					<div class="min-w-0 flex-1">
						<div class="flex items-center justify-between gap-2">
							<span class="text-foreground text-sm font-medium">{g.label}</span>
							<span class="text-muted-foreground shrink-0 text-xs tabular-nums">~{g.approxMB} MB</span>
						</div>
						<p class="text-muted-foreground text-xs">{g.description}</p>
					</div>
				</label>
			{/each}
			<p class="text-muted-foreground px-1 text-[11px] leading-relaxed">
				Anything not included still downloads automatically the first time a document uses it,
				then it's cached too.
			</p>
		</div>

		{#if installing && progress}
			<div class="flex flex-col gap-1.5">
				<div class="text-muted-foreground flex items-center gap-2 text-xs">
					<IconLoader2 size={14} class="animate-spin" />
					<span class="min-w-0 flex-1 truncate">{progress.label}</span>
					<span class="shrink-0 tabular-nums">{pct}%</span>
				</div>
				<div class="bg-muted h-1.5 overflow-hidden rounded-full">
					<div class="bg-primary h-full rounded-full transition-all" style="width:{pct}%"></div>
				</div>
			</div>
		{/if}

		{#if error}
			<div
				class="border-destructive/30 bg-destructive/5 flex items-start gap-2 rounded-md border p-2.5"
				role="alert"
			>
				<IconAlertTriangle size={15} class="text-destructive mt-0.5 shrink-0" />
				<p class="text-foreground/90 min-w-0 flex-1 text-xs leading-relaxed">{error}</p>
			</div>
		{/if}

		<div class="flex items-center justify-between gap-3">
			<span class="text-muted-foreground text-xs tabular-nums">Total ~{totalMB} MB</span>
			<Button size="sm" onclick={start} disabled={installing}>
				{#if installing}
					Installing…
				{:else if error}
					Retry
				{:else}
					Download & install
				{/if}
			</Button>
		</div>
	</DialogContent>
</Dialog>
