<script lang="ts">
	import { settings, type Appearance } from "@glyphtex/ui/settings";
	import { ToggleGroup, ToggleGroupItem } from "@glyphtex/ui/toggle-group";
	import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-svelte";

	import SettingsSection from "./SettingsSection.svelte";

	const themes: { value: Appearance; label: string; icon: typeof IconSun }[] = [
		{ value: "light", label: "Light", icon: IconSun },
		{ value: "dark", label: "Dark", icon: IconMoon },
		{ value: "system", label: "System", icon: IconDeviceDesktop }
	];
</script>

<div class="flex flex-col gap-10">
	<SettingsSection title="Appearance" description="Applies to the workspace and the editor in this browser.">
		<div class="border-border bg-background flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
			<div class="flex flex-col gap-0.5">
				<p class="text-foreground text-sm font-medium">Theme</p>
				<p class="text-muted-foreground text-sm">System follows your device setting.</p>
			</div>
			<ToggleGroup
				type="single"
				label="Theme"
				bind:value={() => settings.appearance, (v) => v && (settings.appearance = v as Appearance)}
			>
				{#each themes as t (t.value)}
					<ToggleGroupItem value={t.value} aria-label={t.label}>
						<t.icon /> <span class="hidden sm:inline">{t.label}</span>
					</ToggleGroupItem>
				{/each}
			</ToggleGroup>
		</div>
	</SettingsSection>

	<SettingsSection
		title="Where your work lives"
		description="Nothing leaves this device unless you save a project to a GlyphTeX server."
	>
		<ul class="border-border bg-background divide-border flex flex-col divide-y rounded-xl border">
			<li class="flex flex-col gap-0.5 p-4">
				<p class="text-foreground text-sm font-medium">Documents</p>
				<p class="text-muted-foreground text-sm">Stored in this browser's storage, per site.</p>
			</li>
			<li class="flex flex-col gap-0.5 p-4">
				<p class="text-foreground text-sm font-medium">Compiling</p>
				<p class="text-muted-foreground text-sm">Runs on this device with the in-browser TeX engine.</p>
			</li>
		</ul>
	</SettingsSection>
</div>
