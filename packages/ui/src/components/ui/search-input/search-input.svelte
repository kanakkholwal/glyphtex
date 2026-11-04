<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import InputGroup from "../input-group/input-group.svelte";
	import InputGroupAddon from "../input-group/input-group-addon.svelte";
	import InputGroupInput from "../input-group/input-group-input.svelte";
	import type { InputGroupSize } from "../input-group/variants.js";
	import { cn } from "../../../lib/cn.js";
	import Shortcut from "../shortcut/shortcut.svelte";
	import { type SearchInputVariant, searchInput } from "./variants";

	let {
		label,
		value = $bindable(""),
		onValueChange,
		shortcut,
		variant = "default",
		size = "default",
		placeholder,
		class: classProp,
		...rest
	}: Omit<HTMLInputAttributes, "type" | "value" | "size" | "class"> & {
		/** Accessible name; also the placeholder unless one is given. */
		label: string;
		/** Bindable. */
		value?: string;
		onValueChange?: (value: string) => void;
		/** A key that focuses the field from anywhere, e.g. `"/"` or `"mod+k"`; shown while empty. */
		shortcut?: string;
		variant?: SearchInputVariant;
		size?: InputGroupSize;
		class?: string;
	} = $props();

	let input = $state<HTMLInputElement | null>(null);
	function set(next: string) {
		value = next;
		onValueChange?.(next);
	}
	const s = $derived(searchInput({ variant }));
</script>

<InputGroup {size} data-slot="search-input" class={cn(s.root(), classProp)}>
	<InputGroupAddon>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true" class={s.icon()}>
			<circle cx="11" cy="11" r="7" />
			<path d="m20 20-3.5-3.5" stroke-linecap="round" />
		</svg>
	</InputGroupAddon>
	<InputGroupInput
		{...rest}
		bind:ref={input}
		type="search"
		aria-label={label}
		placeholder={placeholder ?? label}
		bind:value={() => value, set}
		onkeydown={(event: KeyboardEvent) => {
			if (event.key === "Escape" && value) {
				event.preventDefault();
				set("");
			}
		}}
		class={s.input()}
	/>
	<InputGroupAddon align="inline-end">
		<span class={s.end()}>
			{#if shortcut}
				<span data-on={!value} class={s.shortcut()}>
					<Shortcut {shortcut} size="sm" ontrigger={() => input?.focus()} />
				</span>
			{/if}
			<button
				type="button"
				aria-label="Clear search"
				data-on={!!value}
				tabindex={value ? 0 : -1}
				class={s.clear()}
				onclick={() => {
					set("");
					input?.focus();
				}}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
				</svg>
			</button>
		</span>
	</InputGroupAddon>
</InputGroup>
