<script lang="ts" module>
	export type EngineVersion = {
		version: string;
		tag: string;
		installed: boolean;
		active: boolean;
	};

	export type CacheInfo = { path: string; bytes: number };
	export type PrefetchResult = { success: boolean; message?: string };

	/** Provided by the host (desktop) — backed by Tauri commands. */
	export type EngineManager = {
		label: string;
		list: () => Promise<EngineVersion[]>;
		download: (version: string) => Promise<string>;
		setActive: (version: string) => Promise<void>;
		/** Managed package-cache controls (optional). */
		cacheInfo?: () => Promise<CacheInfo>;
		clearCache?: () => Promise<void>;
		prefetch?: () => Promise<PrefetchResult>;
	};
</script>

<script lang="ts">
	import { Button } from '@glyph/ui/button';
	import { toast } from '@glyph/ui/sonner';

	/**
	 * EngineSettings — list / download / activate engine (Tectonic) versions from
	 * GitHub releases, so the engine can be updated without rebuilding the app.
	 * Also exposes the managed package cache (size / clear / pre-warm).
	 */
	let { engine }: { engine: EngineManager } = $props();

	let versions = $state<EngineVersion[]>([]);
	let loading = $state(false);
	let busy = $state<string | undefined>(undefined);
	let error = $state<string | undefined>(undefined);
	let loaded = $state(false);

	let cache = $state<CacheInfo | undefined>(undefined);
	let prefetching = $state(false);
	let clearing = $state(false);

	function fmtBytes(n: number): string {
		if (!n) return '0 B';
		const u = ['B', 'KB', 'MB', 'GB'];
		const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
		return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
	}

	async function refreshCache() {
		if (!engine.cacheInfo) return;
		try {
			cache = await engine.cacheInfo();
		} catch {
			/* ignore */
		}
	}

	async function prefetch() {
		if (!engine.prefetch) return;
		prefetching = true;
		try {
			const r = await engine.prefetch();
			if (r.success) toast.success('Common packages cached for offline use');
			else toast.error(r.message ?? 'Prefetch failed');
			await refreshCache();
		} catch (e) {
			toast.error(String(e));
		} finally {
			prefetching = false;
		}
	}

	async function clearCache() {
		if (!engine.clearCache) return;
		clearing = true;
		try {
			await engine.clearCache();
			toast.success('Package cache cleared');
			await refreshCache();
		} catch (e) {
			toast.error(String(e));
		} finally {
			clearing = false;
		}
	}

	$effect(() => {
		refreshCache();
	});

	async function refresh() {
		loading = true;
		error = undefined;
		try {
			versions = await engine.list();
			loaded = true;
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function download(version: string) {
		busy = version;
		error = undefined;
		try {
			await engine.download(version);
			await refresh();
		} catch (e) {
			error = String(e);
		} finally {
			busy = undefined;
		}
	}

	async function use(version: string) {
		error = undefined;
		try {
			await engine.setActive(version);
			await refresh();
		} catch (e) {
			error = String(e);
		}
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between">
		<span class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
			{engine.label} engine
		</span>
		<Button variant="ghost" size="sm" onclick={refresh} disabled={loading}>
			{loading ? 'Checking…' : 'Check versions'}
		</Button>
	</div>

	{#if error}
		<p class="text-destructive text-xs">{error}</p>
	{/if}

	{#if !loaded && !loading}
		<p class="text-muted-foreground text-xs">
			Fetch available Tectonic versions to download or switch — no rebuild needed.
		</p>
	{/if}

	{#if versions.length}
		<div class="flex flex-col gap-1">
			{#each versions.slice(0, 8) as v (v.version)}
				{@const nightly = v.version === 'nightly'}
				<div class="border-border flex items-center gap-2 rounded-md border px-2 py-1.5">
					<span class="text-foreground text-sm {nightly ? 'capitalize' : 'tabular-nums'}">
						{v.version}
					</span>
					{#if nightly}
						<span class="text-brand text-[10px] font-medium" title="Newer xetex-layout — fixes the fontawesome5 / icon-font crash">
							fixes icon fonts
						</span>
					{/if}
					{#if v.active}
						<span class="text-success text-[10px] font-semibold tracking-wide uppercase">Active</span>
					{:else if v.installed}
						<span class="text-muted-foreground/70 text-[10px] tracking-wide uppercase">Installed</span>
					{/if}
					<div class="ml-auto">
						{#if !v.installed}
							<Button
								variant={nightly ? 'secondary' : 'outline'}
								size="xs"
								onclick={() => download(v.version)}
								disabled={busy === v.version}
							>
								{busy === v.version ? 'Downloading…' : 'Download'}
							</Button>
						{:else if !v.active}
							<Button variant="secondary" size="xs" onclick={() => use(v.version)}>Use</Button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if engine.cacheInfo}
		<div class="border-border/60 mt-1 flex flex-col gap-2 border-t pt-3">
			<div class="flex items-center justify-between">
				<span class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
					Package cache
				</span>
				{#if cache}
					<span class="text-muted-foreground/70 text-xs tabular-nums">{fmtBytes(cache.bytes)}</span>
				{/if}
			</div>
			<p class="text-muted-foreground text-xs leading-relaxed">
				Packages download on demand and cache here for offline use. Pre-warm common ones, or clear
				to reclaim space.
			</p>
			<div class="flex gap-1.5">
				{#if engine.prefetch}
					<Button variant="outline" size="xs" onclick={prefetch} disabled={prefetching}>
						{prefetching ? 'Caching…' : 'Prefetch common'}
					</Button>
				{/if}
				{#if engine.clearCache}
					<Button variant="ghost" size="xs" onclick={clearCache} disabled={clearing}>
						{clearing ? 'Clearing…' : 'Clear cache'}
					</Button>
				{/if}
			</div>
		</div>
	{/if}
</div>
