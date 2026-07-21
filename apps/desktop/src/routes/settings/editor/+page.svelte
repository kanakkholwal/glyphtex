<script lang="ts">
	import { Select, SelectContent, SelectItem, SelectTrigger } from '@glyphx/ui/select';
	import { SettingsField } from '@glyphx/ui/settings-field';
	import { SettingsSection } from '@glyphx/ui/settings-section';
	import { SliderControl } from '@glyphx/ui/slider-control';
	import { Switch } from '@glyphx/ui/switch';
	import {
		AUTO_SAVE_LABELS,
		EDITOR_FONT_LABELS,
		settings,
		type AutoSaveMode,
		type EditorFont
	} from '@glyphx/ui/settings';

	const fontOpts = (Object.keys(EDITOR_FONT_LABELS) as EditorFont[]).map((id) => ({
		value: id,
		label: EDITOR_FONT_LABELS[id]
	}));
	const autoSaveOpts = (Object.keys(AUTO_SAVE_LABELS) as AutoSaveMode[]).map((id) => ({
		value: id,
		label: AUTO_SAVE_LABELS[id]
	}));
</script>

{#snippet selectRow(
	label: string,
	description: string,
	opts: readonly { value: string; label: string }[],
	current: string,
	onChange: (v: string) => void
)}
	<div class="px-5 py-4">
		<SettingsField {label} {description} layout="row">
			<Select type="single" value={current} onValueChange={onChange}>
				<SelectTrigger size="sm" class="min-w-28" aria-label={label}>
					{opts.find((o) => o.value === current)?.label ?? current}
				</SelectTrigger>
				<SelectContent>
					{#each opts as o (o.value)}
						<SelectItem value={o.value}>{o.label}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</SettingsField>
	</div>
{/snippet}

{#snippet switchRow(
	label: string,
	description: string,
	checked: boolean,
	onChange: (v: boolean) => void
)}
	<div class="px-5 py-4">
		<SettingsField {label} {description} layout="row">
			<Switch {checked} onCheckedChange={onChange} aria-label={label} />
		</SettingsField>
	</div>
{/snippet}

<div class="flex flex-col gap-8">
	<header>
		<h2 class="font-display text-2xl font-semibold tracking-tight">Editor</h2>
		<p class="text-muted-foreground mt-1.5 text-sm">
			Highlighting, typeface, and compile behaviour.
		</p>
	</header>

	<SettingsSection label="Display" divided>
		{@render selectRow(
			'Editor font',
			'Monospace typeface for the editing surface.',
			fontOpts,
			settings.font,
			(v) => (settings.font = v as EditorFont)
		)}
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
		{@render switchRow(
			'Line wrapping',
			'Wrap long lines instead of scrolling horizontally.',
			settings.lineWrapping,
			(v) => (settings.lineWrapping = v)
		)}
	</SettingsSection>

	<SettingsSection label="Compilation" divided>
		{@render selectRow(
			'Auto save',
			'When edits are written to disk — off (⌘/Ctrl+S only), after a short delay, or on focus change. The preview always renders the last saved version.',
			autoSaveOpts,
			settings.autoSave,
			(v) => (settings.autoSave = v as AutoSaveMode)
		)}
		{@render switchRow(
			'Live compile',
			'Recompile automatically whenever a file is saved. Pair with “After delay” auto save for a type-and-see preview.',
			settings.autoCompile,
			(v) => (settings.autoCompile = v)
		)}
		{@render switchRow(
			'Shell escape',
			'Allow \\write18 so packages like minted / gnuplot can run external tools. Off by default — only enable it for documents you trust.',
			settings.shellEscape,
			(v) => (settings.shellEscape = v)
		)}
	</SettingsSection>
</div>
