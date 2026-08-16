<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { PanelSection } from "@glyphtex/ui/panel-section";
	import { Select, SelectContent, SelectItem, SelectTrigger } from "@glyphtex/ui/select";
	import {
		AUTO_SAVE_DELAYS,
		AUTO_SAVE_LABELS,
		EDITOR_FONT_LABELS,
		settings,
		type Appearance,
		type AutoSaveMode,
		type EditorFont,
		type SidebarPosition
	} from "@glyphtex/ui/settings";
	import { SettingsField } from "@glyphtex/ui/settings-field";
	import { SliderControl } from "@glyphtex/ui/slider-control";
	import { Spinner } from "@glyphtex/ui/spinner";
	import { Switch } from "@glyphtex/ui/switch";
	import { IconCheck } from "@tabler/icons-svelte";

	import type { EngineManager } from "../engine-settings.svelte";
	import EngineSettings from "../engine-settings.svelte";

	/**
	 * Live preferences for the open document, grouped into titled sections.
	 * Everything here writes straight to the settings store; there is no Apply.
	 */
	let {
		engine,
		hasShellIntegration,
		shellStatus = "idle",
		onaddshell
	}: {
		engine?: EngineManager;
		hasShellIntegration: boolean;
		/** Progress of the one-shot "Open with GlyphTeX" registration. */
		shellStatus?: "idle" | "busy" | "done";
		onaddshell?: () => void;
	} = $props();

	const appearanceOpts: { value: Appearance; label: string }[] = [
		{ value: "light", label: "Light" },
		{ value: "dark", label: "Dark" },
		{ value: "system", label: "System" }
	];
	const sidebarOpts: { value: SidebarPosition; label: string }[] = [
		{ value: "left", label: "Left" },
		{ value: "right", label: "Right" }
	];
	const fontOpts = (Object.keys(EDITOR_FONT_LABELS) as EditorFont[]).map((id) => ({
		value: id,
		label: EDITOR_FONT_LABELS[id]
	}));
	const delayOpts = AUTO_SAVE_DELAYS.map((ms) => ({
		value: String(ms),
		label: ms < 1000 ? `${ms} ms` : `${ms / 1000} s`
	}));
	const autoSaveOpts = (Object.keys(AUTO_SAVE_LABELS) as AutoSaveMode[]).map((id) => ({
		value: id,
		label: AUTO_SAVE_LABELS[id]
	}));
</script>

<!-- A single-choice setting: label on the left, a compact dropdown on the right,
     sharing one line to save vertical space in a 320px column. -->
{#snippet selectField(
	label: string,
	opts: readonly { value: string; label: string }[],
	current: string,
	onChange: (v: string) => void,
	description = ''
)}
	<SettingsField size="sm" {label} {description} layout="row">
		<Select type="single" value={current} onValueChange={onChange}>
			<SelectTrigger size="sm" class="min-w-[7.5rem] text-xs" aria-label={label}>
				{opts.find((o) => o.value === current)?.label ?? current}
			</SelectTrigger>
			<SelectContent>
				{#each opts as o (o.value)}
					<SelectItem value={o.value}>{o.label}</SelectItem>
				{/each}
			</SelectContent>
		</Select>
	</SettingsField>
{/snippet}

{#snippet switchField(
	label: string,
	checked: boolean,
	onChange: (v: boolean) => void,
	description = ''
)}
	<SettingsField size="sm" {label} {description} layout="row">
		<Switch {checked} onCheckedChange={onChange} aria-label={label} />
	</SettingsField>
{/snippet}

<div class="flex flex-col gap-5 px-1 pt-1 pb-3">
	<!-- Theme and panel side were two sections holding one row each. -->
	<PanelSection title="Appearance">
		{@render selectField(
			'Theme',
			appearanceOpts,
			settings.appearance,
			(v) => (settings.appearance = v as Appearance)
		)}
		{@render selectField(
			'Side panel',
			sidebarOpts,
			settings.sidebarPosition,
			(v) => (settings.sidebarPosition = v as SidebarPosition)
		)}
	</PanelSection>

	<PanelSection title="Editor">
		{@render selectField('Font', fontOpts, settings.font, (v) => (settings.font = v as EditorFont))}

		<!-- 10 to 32 in steps of 1. This was 8 to 80 in steps of 2, which put the
		     default of 13 between two stops: you could not select it back. -->
		<SliderControl
			label="Font size"
			value={settings.fontSize}
			min={10}
			max={32}
			step={1}
			unit="px"
			onchange={(v) => (settings.fontSize = v)}
		/>

		{@render switchField(
			'Wrap long lines',
			settings.lineWrapping,
			(v) => (settings.lineWrapping = v)
		)}
	</PanelSection>

	<PanelSection title="Building">
		{@render switchField(
			'Live compile',
			settings.autoCompile,
			(v) => (settings.autoCompile = v),
			'Rebuild the PDF as you type.'
		)}

		{@render selectField(
			'Auto save',
			autoSaveOpts,
			settings.autoSave,
			(v) => (settings.autoSave = v as AutoSaveMode),
			'When edits are written to disk.'
		)}

		{#if settings.autoSave === 'afterDelay'}
			{@render selectField(
				'Save delay',
				delayOpts,
				String(settings.autoSaveDelayMs),
				(v) => (settings.autoSaveDelayMs = Number(v)),
				'How long typing has to stop before the file is written.'
			)}
		{/if}
	</PanelSection>

	{#if engine}
		<PanelSection title="Engine">
			<EngineSettings {engine} />
		</PanelSection>
	{/if}

	{#if hasShellIntegration}
		<PanelSection title="System">
			<SettingsField
				size="sm"
				label="Shell integration"
				description="Adds “Open with GlyphTeX” to the folder right-click menu."
				layout="row"
			>
				<Button
					variant={shellStatus === 'done' ? 'success_soft' : 'default_soft'}
					size="xs"
					disabled={shellStatus === 'busy'}
					onclick={() => onaddshell?.()}
				>
					{#if shellStatus === 'busy'}
						<Spinner class="size-3" /> Adding…
					{:else if shellStatus === 'done'}
						<IconCheck size={13} /> Added
					{:else}
						Add
					{/if}
				</Button>
			</SettingsField>
		</PanelSection>
	{/if}
</div>
