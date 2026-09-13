<script lang="ts">
	import { engineManager } from "$lib/engine";
	import SettingsHeader from "$lib/settings-header.svelte";
	import { EngineSettings } from "@glyphtex/ui/application";
</script>

<SettingsHeader
	title="Engine"
	description="Bundled Tectonic needs no install. System TeX uses your TeX Live or MiKTeX."
/>

<EngineSettings engine={engineManager} />
