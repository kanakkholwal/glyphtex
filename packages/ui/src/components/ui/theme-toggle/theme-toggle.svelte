<script lang="ts">
	import { settings, type Appearance } from "@glyphtex/ui/settings";
	import { Button, type ButtonSize } from "@glyphtex/ui/button";
	import { IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons-svelte';

	/**
	 * ThemeToggle — cycles light → dark → system. Reads/writes the settings
	 * store, so a change here syncs to every other window/tab instantly.
	 * Lightweight (no editor deps) — safe to drop in the marketing nav.
	 */
	let {
		class: className = "",
		size = "icon-sm",
	}: { class?: string; size?: ButtonSize } = $props();

	const labels: Record<Appearance, string> = {
		light: "Light",
		dark: "Dark",
		system: "System",
	};
</script>

<Button
	variant="ghost"
	{size}
	class={className}
	title={`Theme: ${labels[settings.appearance]}`}
	aria-label={`Theme: ${labels[settings.appearance]}. Click to change.`}
	onclick={() => settings.cycle()}
>
	{#if settings.appearance === "light"}
		<IconSun />
	{:else if settings.appearance === "dark"}
		<IconMoon />
	{:else}
		<IconDeviceDesktop />
	{/if}
</Button>
