<script lang="ts">
	import { settings } from "@glyphtex/ui/settings";
	import { ThemeToggle } from "../theme-toggle";
	import { button, type ButtonSize } from "../button/variants";
	import { cn } from "../../../lib/cn.js";

	// The settings store owns the theme; this only feeds baby-ui's controlled toggle.
	let { class: className, size = "icon" }: { class?: string; size?: ButtonSize } = $props();
</script>

<ThemeToggle
	theme={settings.resolved}
	onThemeChange={(next) => {
		settings.appearance = next;
		settings.apply();
	}}
	class={cn(button({ variant: "ghost", size }), className)}
	iconClass="size-4"
/>
