<script lang="ts">
	import SettingsHeader from "$lib/settings-header.svelte";
	import SettingsSelect from "$lib/settings-select.svelte";
	import { SettingsSection } from "@glyphtex/ui/settings-section";
	import { settings, type Appearance, type SidebarPosition } from "@glyphtex/ui/settings";

	const appearanceOpts: { value: Appearance; label: string }[] = [
		{ value: "system", label: "System" },
		{ value: "light", label: "Light" },
		{ value: "dark", label: "Dark" }
	];
	const sidebarOpts: { value: SidebarPosition; label: string }[] = [
		{ value: "left", label: "Left" },
		{ value: "right", label: "Right" }
	];
</script>

<SettingsHeader title="General" description="Appearance and app-wide preferences." />

<SettingsSection label="Appearance" divided>
	<SettingsSelect
		label="Theme"
		description="Follow the system, or always use light or dark."
		options={appearanceOpts}
		value={settings.appearance}
		onchange={(v) => (settings.appearance = v)}
	/>
	<SettingsSelect
		label="Side panel"
		description="Which side of the editor the side panel docks on."
		options={sidebarOpts}
		value={settings.sidebarPosition}
		onchange={(v) => (settings.sidebarPosition = v)}
	/>
</SettingsSection>
