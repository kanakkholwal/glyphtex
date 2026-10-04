<script lang="ts">
	import InputGroup from "../input-group/input-group.svelte";
	import InputGroupAddon from "../input-group/input-group-addon.svelte";
	import InputGroupInput from "../input-group/input-group-input.svelte";
	import { cn } from "../../../lib/cn.js";
	import {
		hexKeyStep,
		hexToHsl,
		hexToHsv,
		hexToRgb,
		hslToHex,
		hsvToHex,
		isValidHex,
		parseHex,
		rgbToHex,
		stepHex
	} from "../../../lib/color.js";
	import Popover from "../popover/popover.svelte";
	import PopoverContent from "../popover/popover-content.svelte";
	import PopoverTrigger from "../popover/popover-trigger.svelte";
	import {
		arrowStep,
		type ColorPickerSize,
		type ColorPickerVariant,
		colorPicker,
		hasEyeDropper,
		pickScreenColor
	} from "./variants";

	export type ColorFormat = "hsv" | "hsl" | "rgb";

	let {
		value = $bindable("#7dd3fc"),
		format = $bindable<ColorFormat>("hsv"),
		swatches = ["#7dd3fc", "#a78bfa", "#86efac", "#fcd34d", "#fda4af", "#f87171", "#e5e7eb"],
		label = "Colour",
		variant = "field",
		size = "md",
		invalid = false,
		disabled = false,
		id,
		name,
		recent = [],
		eyedropper = true,
		open = $bindable(false),
		onOpenChange,
		class: classProp
	}: {
		value?: string;
		format?: ColorFormat;
		swatches?: string[];
		label?: string;
		/**
		 * `field` (default) swatch + hex field, `row` labelled panel row, `inline` full picker,
		 * `area` saturation square, `slider` hue strip, `swatch` one disc, `swatches` discs to pick.
		 */
		variant?: ColorPickerVariant;
		/** Size of the field, area, slider and discs; the inline panel keeps its width. */
		size?: ColorPickerSize;
		/** `field`: marks the hex input invalid from outside, e.g. a form error. */
		invalid?: boolean;
		disabled?: boolean;
		/** `field`: id and form name of the hex input. */
		id?: string;
		name?: string;
		/** Recently used colours, newest first; the parent owns the list. */
		recent?: string[];
		/** Offer the screen eyedropper where the browser supports it. */
		eyedropper?: boolean;
		/** Bindable; field variant only. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		class?: string;
	} = $props();

	const s = $derived(colorPicker({ variant, size }));
	let canDrop = $state(false);
	$effect(() => {
		canDrop = eyedropper && hasEyeDropper();
	});

	const uid = $props.id();

	let hue = $state(0);
	let sat = $state(0);
	let val = $state(100);
	let hex = $state(isValidHex(value) ? value.toLowerCase() : "#000000");

	/**
	 * HSL lives beside HSV rather than being derived from the hex: a grey hex has no
	 * hue at all, so a round trip would snap the H slider back to 0 mid-drag.
	 */
	let hslH = $state(0);
	let hslS = $state(0);
	let hslL = $state(100);
	let rgb = $state<[number, number, number]>([255, 255, 255]);
	let skipSync = false;

	let square = $state<HTMLDivElement>();
	let strip = $state<HTMLDivElement>();
	let dragging = $state<"square" | "strip" | null>(null);

	const hueColor = $derived(`hsl(${hue}, 100%, 50%)`);
	const preview = $derived(isValidHex(hex) ? hex : isValidHex(value) ? value : "#000000");

	// The field's typed text; null shows the committed value.
	let draft = $state<string | null>(null);
	const parsed = $derived(draft === null ? preview : parseHex(draft));

	function commitHex(next: string) {
		draft = null;
		if (next !== preview) apply(next);
	}

	function hexKeydown(event: KeyboardEvent) {
		const step = hexKeyStep(event.key);
		if (event.key === "Enter" && parsed) commitHex(parsed);
		else if (event.key === "Escape") draft = null;
		else if (step !== null) {
			event.preventDefault();
			commitHex(stepHex(parsed ?? preview, step));
		}
	}

	// Not $derived: `value` is externally controlled and can change at any time, and syncs
	// into five representations that aren't uniquely invertible from hex alone (grey has no hue).
	$effect(() => {
		if (!isValidHex(value)) return;
		const lower = value.toLowerCase();
		const [h, s, v] = hexToHsv(value);
		hue = h;
		sat = s;
		val = v;
		hex = lower;
		rgb = hexToRgb(value);
		if (skipSync) {
			skipSync = false;
			return;
		}
		const [hh, hs, hl] = hexToHsl(value);
		if (hs > 0) hslH = hh;
		hslS = hs;
		hslL = hl;
	});

	function apply(next: string) {
		if (isValidHex(next)) value = next;
	}

	function applyHsv() {
		hex = hsvToHex(hue, sat, val);
		value = hex;
	}

	function setHsl(channel: "h" | "s" | "l", raw: string) {
		const next = Number.parseFloat(raw);
		if (!Number.isFinite(next)) return;
		if (channel === "h") {
			hslH = next;
			// At S=0 every hue is the same grey, so moving H would feel dead.
			if (hslS === 0) hslS = 60;
		} else if (channel === "s") {
			hslS = next;
		} else {
			hslL = next;
		}
		skipSync = true;
		apply(hslToHex(hslH, hslS, hslL));
	}

	function setRgb(channel: 0 | 1 | 2, raw: string) {
		const next = Number.parseFloat(raw);
		if (!Number.isFinite(next)) return;
		const copy: [number, number, number] = [...rgb];
		copy[channel] = next;
		rgb = copy;
		apply(rgbToHex(copy[0], copy[1], copy[2]));
	}

	function typeHex(raw: string) {
		const digits = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
		hex = `#${digits}`;
		apply(hex);
	}

	function clamp(n: number) {
		return Math.max(0, Math.min(1, n));
	}

	function readSquare(event: PointerEvent) {
		if (!square) return;
		const rect = square.getBoundingClientRect();
		sat = Math.round(clamp((event.clientX - rect.left) / rect.width) * 100);
		val = Math.round(clamp(1 - (event.clientY - rect.top) / rect.height) * 100);
		applyHsv();
	}

	function readStrip(event: PointerEvent) {
		if (!strip) return;
		const rect = strip.getBoundingClientRect();
		hue = Math.round(clamp((event.clientX - rect.left) / rect.width) * 360);
		applyHsv();
	}

	function onpointermove(event: PointerEvent) {
		if (dragging === "square") readSquare(event);
		else if (dragging === "strip") readStrip(event);
	}

	const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

	function areaKeydown(event: KeyboardEvent) {
		const step = arrowStep(event.key, event.shiftKey);
		if (!step) return;
		event.preventDefault();
		sat = clamp100(sat + step.dx);
		val = clamp100(val + step.dy);
		applyHsv();
	}

	function trackKeydown(event: KeyboardEvent) {
		const step = arrowStep(event.key, event.shiftKey);
		if (!step) return;
		event.preventDefault();
		hue = Math.max(0, Math.min(360, hue + step.dx + step.dy));
		applyHsv();
	}

	const CHANNELS = $derived(
		format === "hsl"
			? ([
					{ key: "h", label: "H", max: 360, unit: "°", value: hslH },
					{ key: "s", label: "S", max: 100, unit: "%", value: hslS },
					{ key: "l", label: "L", max: 100, unit: "%", value: hslL }
				] as const)
			: format === "rgb"
				? ([
						{ key: "r", label: "R", max: 255, unit: "", value: rgb[0] },
						{ key: "g", label: "G", max: 255, unit: "", value: rgb[1] },
						{ key: "b", label: "B", max: 255, unit: "", value: rgb[2] }
					] as const)
				: ([
						{ key: "h", label: "H", max: 360, unit: "°", value: hue },
						{ key: "s", label: "S", max: 100, unit: "%", value: sat },
						{ key: "v", label: "V", max: 100, unit: "%", value: val }
					] as const)
	);

	function setChannel(key: string, raw: string) {
		if (format === "hsl") return setHsl(key as "h" | "s" | "l", raw);
		if (format === "rgb") return setRgb(key === "r" ? 0 : key === "g" ? 1 : 2, raw);
		const next = Number.parseFloat(raw);
		if (!Number.isFinite(next)) return;
		if (key === "h") hue = next;
		else if (key === "s") sat = next;
		else val = next;
		applyHsv();
	}

	const FORMATS: ColorFormat[] = ["hsv", "hsl", "rgb"];
</script>

<svelte:window {onpointermove} onpointerup={() => (dragging = null)} onpointercancel={() => (dragging = null)} />

{#snippet area()}
	<div
		bind:this={square}
		role="slider"
		tabindex={disabled ? -1 : 0}
		aria-label="{label} saturation and brightness"
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={sat}
		aria-valuetext="Saturation {sat}%, brightness {val}%"
		aria-disabled={disabled || undefined}
		style:--picker-hue={hueColor}
		style:background="linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, var(--picker-hue))"
		onpointerdown={(e) => {
			dragging = "square";
			square?.setPointerCapture(e.pointerId);
			readSquare(e);
		}}
		onkeydown={areaKeydown}
		class={cn(s.area(), variant === "area" && classProp)}
	>
		<span
			aria-hidden="true"
			style:left="{sat}%"
			style:top="{100 - val}%"
			style:background={preview}
			class={s.areaThumb()}
		></span>
	</div>
{/snippet}

{#snippet track()}
	<div
		bind:this={strip}
		role="slider"
		tabindex={disabled ? -1 : 0}
		aria-label="{label} hue"
		aria-valuemin={0}
		aria-valuemax={360}
		aria-valuenow={hue}
		aria-valuetext="{hue}°"
		aria-disabled={disabled || undefined}
		onpointerdown={(e) => {
			dragging = "strip";
			strip?.setPointerCapture(e.pointerId);
			readStrip(e);
		}}
		onkeydown={trackKeydown}
		style:background="linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
		class={s.track()}
	>
		<span
			aria-hidden="true"
			style:left="{(hue / 360) * 100}%"
			style:background={hueColor}
			class={s.trackThumb()}
		></span>
	</div>
{/snippet}

{#snippet picker()}
	<div
		class={cn(
			"w-60 select-none overflow-hidden rounded-xl bg-popover shadow-(--overlay-shadow)",
			variant === "inline" && classProp,
		)}
	>
		{@render area()}

		<div class="flex items-center gap-2.5 border-border border-b p-2">
			<span
				aria-hidden="true"
				style:background={preview}
				class="size-7 shrink-0 rounded-md ring-1 ring-foreground/10 ring-inset"
			></span>
			<div class="min-w-0 flex-1 space-y-1.5">
				{@render track()}
				<div
					class="flex items-center gap-1 rounded-md border border-border bg-background px-1.5 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring"
				>
					<span class="font-mono text-xs text-muted-foreground">#</span>
					<input
						id="{uid}-hex"
						value={hex.replace(/^#/, "")}
						aria-label="{label} hex value"
						placeholder="000000"
						spellcheck="false"
						autocomplete="off"
						oninput={(e) => typeHex(e.currentTarget.value)}
						class="h-6 min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground uppercase outline-none"
					/>
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-1.5 border-border border-b p-2">
			<div class="flex items-center gap-0.5 rounded-md bg-card p-0.5">
				{#each FORMATS as option (option)}
					<button
						type="button"
						onclick={() => (format = option)}
						aria-pressed={format === option}
						class="h-5 flex-1 rounded font-mono text-xs text-muted-foreground uppercase transition-colors aria-pressed:bg-background aria-pressed:text-foreground"
					>
						{option}
					</button>
				{/each}
			</div>

			{#each CHANNELS as channel (channel.key)}
				<div class="flex items-center gap-2">
					<label for="{uid}-{channel.key}" class="w-3 shrink-0 font-mono text-xs text-muted-foreground">
						{channel.label}
					</label>
					<input
						id="{uid}-{channel.key}"
						type="range"
						min="0"
						max={channel.max}
						step="1"
						value={channel.value}
						style:--thumb={preview}
						oninput={(e) => setChannel(channel.key, e.currentTarget.value)}
						class="color-slider h-1 flex-1"
					/>
					<span class="w-9 shrink-0 text-right font-mono text-xs text-foreground tabular-nums">
						{channel.value}{channel.unit}
					</span>
				</div>
			{/each}
		</div>

		<div class="flex flex-wrap items-center gap-1.5 p-2">
			{#each swatches as swatch (swatch)}
				<button
					type="button"
					aria-label={swatch}
					aria-pressed={value.toLowerCase() === swatch.toLowerCase()}
					onclick={() => apply(swatch)}
					style:background={swatch}
					class="grid size-6 place-items-center rounded-md ring-1 ring-foreground/10 ring-inset transition-[transform,scale,translate] hover:scale-110"
				>
					{#if value.toLowerCase() === swatch.toLowerCase()}
						<svg viewBox="0 0 12 12" fill="none" aria-hidden="true" class="size-3 text-white drop-shadow-[0_1px_1px_rgb(0_0_0/0.6)]">
							<path d="M2.5 6.2 4.8 8.5 9.5 3.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					{/if}
				</button>
			{/each}
		</div>
		{#if recent.length || canDrop}
			<div class={s.extras()}>
				{#if recent.length}<span class={s.extrasLabel()}>Recent</span>{/if}
				{#each recent as swatch (swatch)}
					<button
						type="button"
						aria-label="Recent {swatch}"
						onclick={() => apply(swatch)}
						style:background={swatch}
						class="size-6 rounded-md ring-1 ring-foreground/10 ring-inset"
					></button>
				{/each}
				{#if canDrop}
					<button
						type="button"
						aria-label="Pick a colour from the screen"
						class={s.eyedropper()}
						onclick={async () => {
							const picked = await pickScreenColor();
							if (picked) apply(picked);
						}}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M11 7l6 6M4 16L15.7 4.3a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4L8 20H4z" />
						</svg>
					</button>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

{#if variant === "inline"}
	{@render picker()}
{:else if variant === "area"}
	{@render area()}
{:else if variant === "slider"}
	<div data-slot="color-picker-slider" class={cn(s.slider(), classProp)}>
		<div class={s.sliderHeader()}>
			<span>Hue</span>
			<span class={s.sliderValue()}>{hue}°</span>
		</div>
		{@render track()}
	</div>
{:else if variant === "swatch"}
	<span
		role="img"
		aria-label="{label}: {preview}"
		data-slot="color-picker-swatch"
		style:background={preview}
		class={cn(s.disc(), classProp)}
	></span>
{:else if variant === "swatches"}
	<fieldset aria-label={label} data-slot="color-picker-swatches" class={cn(s.discs(), classProp)}>
		{#each swatches as swatch (swatch)}
			<label class={s.discLabel()}>
				<!-- A native radio under each disc, so arrow keys and forms work as radios do. -->
				<input
					type="radio"
					name="{uid}-swatch"
					value={swatch}
					checked={swatch.toLowerCase() === value.toLowerCase()}
					{disabled}
					aria-label={swatch}
					onchange={() => apply(swatch)}
					class="peer sr-only"
				/>
				<span
					aria-hidden="true"
					style:background={swatch}
					style:--disc={swatch}
					class={cn(s.discOption(), s.disc())}
				></span>
			</label>
		{/each}
	</fieldset>
{:else}
	{#snippet swatchPicker(align: "start" | "end")}
		<Popover bind:open onOpenChange={(next) => onOpenChange?.(next)}>
			<PopoverTrigger {disabled} aria-label="Pick {label.toLowerCase()}" class={s.trigger()}>
				<span aria-hidden="true" class={s.swatch()} style:background-color={parsed ?? preview}></span>
			</PopoverTrigger>
			<PopoverContent {align} class={s.content()}>
				{@render picker()}
			</PopoverContent>
		</Popover>
	{/snippet}
	{#if variant === "row"}
		<!-- The row variant: label, then the hex you can type into, then the swatch for the picker. -->
		<div data-slot="color-picker-row" class={cn(s.row(), classProp)}>
			<label for={id ?? `${uid}-hex`} class={s.rowLabel()}>{label}</label>
			<input
				id={id ?? `${uid}-hex`}
				{name}
				{disabled}
				aria-invalid={invalid || parsed === null || undefined}
				spellcheck={false}
				autocomplete="off"
				value={draft ?? preview.toUpperCase()}
				oninput={(e) => (draft = e.currentTarget.value)}
				onblur={() => (parsed ? commitHex(parsed) : (draft = null))}
				onkeydown={hexKeydown}
				class={s.rowHex()}
			/>
			{@render swatchPicker("end")}
		</div>
	{:else}
		<!-- The field variant: a swatch that opens the picker beside a hex input you can type into. -->
		<InputGroup {size} data-slot="color-picker-field" class={cn(s.field(), classProp)}>
			<InputGroupAddon>{@render swatchPicker("start")}</InputGroupAddon>
			<InputGroupInput
				{id}
				{name}
				{disabled}
				aria-label={label}
				invalid={invalid || parsed === null}
				spellcheck={false}
				autocomplete="off"
				value={draft ?? preview.toUpperCase()}
				oninput={(e) => (draft = e.currentTarget.value)}
				onblur={() => (parsed ? commitHex(parsed) : (draft = null))}
				onkeydown={hexKeydown}
				class={s.hexInput()}
			/>
		</InputGroup>
	{/if}
{/if}
