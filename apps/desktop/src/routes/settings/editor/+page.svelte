<script lang="ts">
	import SettingsHeader from "$lib/settings-header.svelte";
	import SettingsSelect from "$lib/settings-select.svelte";
	import SettingsSwitch from "$lib/settings-switch.svelte";
	import { Badge } from "@glyphtex/ui/badge";
	import { SettingsSection } from "@glyphtex/ui/settings-section";
	import { SliderControl } from "@glyphtex/ui/slider-control";
	import {
		AUTO_SAVE_LABELS,
		EDITOR_FONT_LABELS,
		settings,
		type AutoSaveMode,
		type EditorFont
	} from "@glyphtex/ui/settings";
	import { IconAlertTriangle } from "@tabler/icons-svelte";

	const fontOpts = (Object.keys(EDITOR_FONT_LABELS) as EditorFont[]).map((id) => ({
		value: id,
		label: EDITOR_FONT_LABELS[id]
	}));
	const autoSaveOpts = (Object.keys(AUTO_SAVE_LABELS) as AutoSaveMode[]).map((id) => ({
		value: id,
		label: AUTO_SAVE_LABELS[id]
	}));
</script>

<SettingsHeader title="Editor" description="Typeface, saving and compile behaviour." />

<SettingsSection label="Display" divided>
	<SettingsSelect
		label="Editor font"
		description="Monospace typeface for the editing surface."
		options={fontOpts}
		value={settings.font}
		onchange={(v) => (settings.font = v)}
	/>
	<div class="px-5 py-4">
		<SliderControl
			label="Font size"
			value={settings.fontSize}
			min={8}
			max={80}
			step={2}
			unit="px"
			onchange={(v) => (settings.fontSize = v)}
		/>
	</div>
	<SettingsSwitch
		label="Line wrapping"
		description="Wrap long lines instead of scrolling sideways."
		checked={settings.lineWrapping}
		onchange={(v) => (settings.lineWrapping = v)}
	/>
</SettingsSection>

<SettingsSection label="Saving and compiling" divided>
	<SettingsSelect
		label="Auto save"
		description="Off saves only on ⌘S or Ctrl+S. The preview shows the last saved version."
		options={autoSaveOpts}
		value={settings.autoSave}
		onchange={(v) => (settings.autoSave = v)}
	/>
	<SettingsSwitch
		label="Live compile"
		description="Recompile whenever a file is saved. Pair with “After delay” for a live preview."
		checked={settings.autoCompile}
		onchange={(v) => (settings.autoCompile = v)}
	/>
	<SettingsSwitch
		label="Shell escape"
		description="Lets packages like minted run programs on your computer. Trusted documents only."
		checked={settings.shellEscape}
		onchange={(v) => (settings.shellEscape = v)}
	>
		{#snippet status()}
			{#if settings.shellEscape}
				<Badge variant="warning"><IconAlertTriangle aria-hidden="true" /> On for every project</Badge>
			{/if}
		{/snippet}
	</SettingsSwitch>
</SettingsSection>
