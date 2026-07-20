<script lang="ts">
	import { cn } from '@glyphx/ui/utils';

	// Draggable wipe comparison. The "raw" surface fills the base and the
	// "polished" surface is clipped to the right of the handle, so dragging
	// left/right wipes between them. Built around images today (static
	// previews); swap the <img> tags for <video> when we have polished takes
	// to compare.

	type Side = {
		src: string;
		label: string;
		durationLabel?: string;
	};

	type Props = {
		raw: Side;
		polished: Side;
		applied?: string[];
		class?: string;
	};

	let { raw, polished, applied = [], class: className = '' }: Props = $props();

	// Handle position, percent from the left edge.
	let pos = $state(52);
	let root: HTMLElement | undefined = $state();
	let dragging = $state(false);

	function setFromX(clientX: number) {
		if (!root) return;
		const rect = root.getBoundingClientRect();
		pos = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
	}

	function onPointerDown(e: PointerEvent) {
		dragging = true;
		root?.setPointerCapture(e.pointerId);
		setFromX(e.clientX);
	}
	function onPointerMove(e: PointerEvent) {
		if (dragging) setFromX(e.clientX);
	}
	function stop() {
		dragging = false;
	}
	function onKeydown(e: KeyboardEvent) {
		const step = e.shiftKey ? 10 : 2;
		if (e.key === 'ArrowLeft') pos = Math.max(0, pos - step);
		else if (e.key === 'ArrowRight') pos = Math.min(100, pos + step);
		else if (e.key === 'Home') pos = 0;
		else if (e.key === 'End') pos = 100;
		else return;
		e.preventDefault();
	}
</script>

<div
	bind:this={root}
	role="slider"
	tabindex="0"
	aria-label="Drag to compare the raw and polished outputs"
	aria-orientation="horizontal"
	aria-valuemin={0}
	aria-valuemax={100}
	aria-valuenow={Math.round(pos)}
	aria-valuetext={`${Math.round(pos)}% polished revealed`}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={stop}
	onpointercancel={stop}
	onkeydown={onKeydown}
	class={cn(
		'group relative aspect-video w-full cursor-ew-resize touch-pan-y overflow-hidden rounded-2xl border border-hairline bg-background shadow-craft-xl ring-1 ring-hairline/40 outline-none select-none focus-visible:ring-2 focus-visible:ring-brand',
		className
	)}
>
	<img
		src={raw.src}
		alt={raw.label}
		loading="lazy"
		decoding="async"
		class="pointer-events-none absolute inset-0 size-full object-cover saturate-[0.85]"
		draggable="false"
	/>
	<img
		src={polished.src}
		alt={polished.label}
		loading="lazy"
		decoding="async"
		class="pointer-events-none absolute inset-0 size-full object-cover"
		style="clip-path: inset(0 0 0 {pos}%);"
		draggable="false"
	/>

	<!-- Corner labels -->
	<span
		class="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/85 ring-1 ring-inset ring-white/15 backdrop-blur"
	>
		{raw.label}
	</span>
	<span
		class="pointer-events-none absolute right-3 top-3 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-brand ring-1 ring-inset ring-brand/30 backdrop-blur"
	>
		{polished.label}
	</span>

	<!-- Applied-feature chips, attributed to the polished side -->
	{#if applied.length > 0}
		<div
			class="pointer-events-none absolute inset-x-0 bottom-10 flex flex-wrap items-center justify-center gap-1.5 px-4"
		>
			{#each applied as feat (feat)}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white/90 ring-1 ring-inset ring-white/15 backdrop-blur"
				>
					<span class="text-brand">✓</span>
					{feat}
				</span>
			{/each}
		</div>
	{/if}

	<!-- Duration labels (optional) -->
	{#if raw.durationLabel}
		<span
			class="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white/80 ring-1 ring-inset ring-white/15 backdrop-blur"
		>
			{raw.durationLabel}
		</span>
	{/if}
	{#if polished.durationLabel}
		<span
			class="pointer-events-none absolute bottom-3 right-3 rounded-md bg-brand/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand ring-1 ring-inset ring-brand/30 backdrop-blur"
		>
			{polished.durationLabel}
		</span>
	{/if}

	<!-- Handle. Decorative: the root element is the actual slider. -->
	<div aria-hidden="true" class="pointer-events-none absolute inset-y-0 z-10" style="left: {pos}%;">
		<div class="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/80"></div>
		<div
			class="absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black shadow-craft-lg ring-1 ring-black/10 transition-transform group-active:scale-95"
		>
			<span class="font-mono text-xs font-bold tracking-tighter">‹›</span>
		</div>
	</div>
</div>
