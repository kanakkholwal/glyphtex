<script lang="ts" module>
	import type { Snippet } from "svelte";

	export interface ColorFieldProps {
		/** Row label (e.g. "Color", "Background"). */
		label: string;
		/** Current color as a CSS hex string (#rrggbb or #rrggbbaa). */
		value: string;
		/** Fired when the user commits a new color from the popover or hex edit. */
		oncommit: (next: string) => void;
		/** Optional preset palette shown in the popover. */
		swatches?: string[];
		/** Optional recents list shown in the popover. */
		recents?: string[];
		/** Show the alpha slider inside the popover. */
		allowAlpha?: boolean;
		/** Leading glyph rendered next to the label. */
		icon?: Snippet;
		disabled?: boolean;
		/** Bits-UI popover alignment. Defaults to `start`. */
		align?: "start" | "center" | "end";
		class?: string;
	}

	const HEX_REGEX = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { ColorPicker } from '@glyphtex/ui/color-picker';
	import * as Popover from '@glyphtex/ui/popover';
	import { cn } from '@glyphtex/ui/utils';

	let {
		label,
		value,
		oncommit,
		swatches,
		recents = [],
		allowAlpha = true,
		icon,
		disabled = false,
		align = 'start',
		class: className
	}: ColorFieldProps = $props();

	// Same row geometry as <SliderControl>. Hovering the hex for 800ms makes it editable;
	// the swatch or label opens the picker.

	const HOVER_REVEAL_MS = 800;

	let isHexHovered = $state(false);
	let isHexEditable = $state(false);
	let showInput = $state(false);
	let inputValue = $state('');
	let inputEl: HTMLInputElement | null = $state(null);
	let hoverTimer: ReturnType<typeof setTimeout> | null = null;

	const displayHex = $derived(value && value.startsWith('#') ? value.toUpperCase() : value);

	$effect(() => {
		if (hoverTimer) {
			clearTimeout(hoverTimer);
			hoverTimer = null;
		}
		if (isHexHovered && !showInput && !isHexEditable && !disabled) {
			hoverTimer = setTimeout(() => {
				isHexEditable = true;
			}, HOVER_REVEAL_MS);
		} else if (!isHexHovered && !showInput) {
			isHexEditable = false;
		}
		return () => {
			if (hoverTimer) {
				clearTimeout(hoverTimer);
				hoverTimer = null;
			}
		};
	});

	$effect(() => {
		if (showInput) {
			tick().then(() => {
				inputEl?.focus();
				inputEl?.select();
			});
		}
	});

	function startHexEdit() {
		showInput = true;
		inputValue = displayHex;
	}

	function commitHexInput() {
		const v = inputValue.trim();
		const withHash = v.startsWith('#') ? v : `#${v}`;
		if (HEX_REGEX.test(withHash)) {
			oncommit(withHash);
		}
		showInput = false;
		isHexHovered = false;
		isHexEditable = false;
	}

	function handleHexKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitHexInput();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			showInput = false;
			isHexHovered = false;
			isHexEditable = false;
		}
	}
</script>

<Popover.Root>
	<div
		class={cn(
			'group/field relative flex h-10 w-full select-none items-center gap-3 overflow-hidden rounded-md border border-border bg-card px-3 text-left outline-none transition-colors duration-150',
			'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
			disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-border-strong',
			className
		)}
	>
		<Popover.Trigger>
			{#snippet child({ props })}
				<button
					type="button"
					{...props}
					{disabled}
					aria-label={`${label}: opens color picker`}
					class={cn(
						'flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none',
						disabled ? 'cursor-not-allowed' : 'cursor-pointer'
					)}
				>
					{#if icon}
						<span class="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground">
							{@render icon()}
						</span>
					{/if}
					<span class="truncate text-xs font-medium text-muted-foreground">
						{label}
					</span>
				</button>
			{/snippet}
		</Popover.Trigger>

		<div class="flex shrink-0 items-center gap-2">
			{#if showInput}
				<input
					bind:this={inputEl}
					type="text"
					spellcheck="false"
					autocomplete="off"
					class="h-6 w-[5.5rem] rounded-sm border border-ring bg-background px-1.5 text-right font-mono text-xs font-medium uppercase tabular-nums text-foreground outline-none"
					value={inputValue}
					oninput={(e) => (inputValue = (e.currentTarget as HTMLInputElement).value)}
					onkeydown={handleHexKeydown}
					onblur={commitHexInput}
					onclick={(e) => e.stopPropagation()}
					onpointerdown={(e) => e.stopPropagation()}
				/>
			{:else}
				<button
					type="button"
					{disabled}
					onmouseenter={() => (isHexHovered = true)}
					onmouseleave={() => (isHexHovered = false)}
					onclick={(e) => {
						if (!isHexEditable || disabled) return;
						e.stopPropagation();
						e.preventDefault();
						startHexEdit();
					}}
					onpointerdown={(e) => {
						if (isHexEditable) e.stopPropagation();
					}}
					aria-label={`${label} hex: hover and click to edit`}
					tabindex={isHexEditable ? 0 : -1}
					class={cn(
						'shrink-0 font-mono text-xs font-medium tabular-nums text-foreground outline-none transition-colors',
						isHexEditable && 'rounded-sm bg-muted px-1 cursor-text',
						!isHexEditable && 'cursor-default'
					)}
					style:cursor={isHexEditable ? 'text' : undefined}
				>
					{displayHex}
				</button>
			{/if}

			<!-- The checker grid underneath lets alpha colours read correctly. -->
			<Popover.Trigger>
				{#snippet child({ props })}
					<button
						type="button"
						{...props}
						{disabled}
						aria-label={`${label} swatch: opens color picker`}
						class={cn(
							'relative inline-block h-4 w-7 overflow-hidden rounded-md border border-border outline-none transition-transform',
							disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-border-strong active:scale-95'
						)}
					>
						<span
							aria-hidden="true"
							class="absolute inset-0"
							style="background-image: conic-gradient(color-mix(in srgb, var(--color-foreground) 10%, transparent) 0deg 90deg, transparent 90deg 180deg, color-mix(in srgb, var(--color-foreground) 10%, transparent) 180deg 270deg, transparent 270deg 360deg); background-size: 6px 6px;"
						></span>
						<span aria-hidden="true" class="absolute inset-0" style:background={value}></span>
					</button>
				{/snippet}
			</Popover.Trigger>
		</div>
	</div>

	<Popover.Content {align} sideOffset={6} class="w-auto p-0">
		<ColorPicker {value} {swatches} {recents} {allowAlpha} {oncommit} />
	</Popover.Content>
</Popover.Root>
