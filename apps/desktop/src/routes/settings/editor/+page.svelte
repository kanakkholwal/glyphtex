<script lang="ts">
	import { Select, SelectContent, SelectItem, SelectTrigger } from '@glyphx/ui/select';
	import { SettingsField } from '@glyphx/ui/settings-field';
	import { SliderControl } from '@glyphx/ui/slider-control';
	import { Switch } from '@glyphx/ui/switch';
	import {
		AUTO_SAVE_LABELS,
		EDITOR_FONT_LABELS,
		settings,
		type AutoSaveMode,
		type EditorFont,
		type LatexGrammar
	} from '@glyphx/ui/settings';

	const grammarOpts: { value: LatexGrammar; label: string }[] = [
		{ value: 'legacy', label: 'stex' },
		{ value: 'lezer', label: 'lezer' }
	];
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
	<div class="px-4 py-3.5">
		<SettingsField {label} {description} layout="row">
			<Select type="single" value={current} onValueChange={onChange}>
				<SelectTrigger size="sm" class="min-w-[9rem]" aria-label={label}>
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
	<div class="px-4 py-3.5">
		<SettingsField {label} {description} layout="row">
			<Switch {checked} onCheckedChange={onChange} aria-label={label} />
		</SettingsField>
	</div>
{/snippet}

<div class="flex max-w-2xl flex-col gap-8">
	<header>
		<h2 class="font-display text-xl font-semibold tracking-tight">Editor</h2>
		<p class="text-muted-foreground mt-1.5 text-sm">
			Highlighting, typeface, and compile behaviour.
		</p>
	</header>

	<section class="flex flex-col gap-2.5">
		<h3 class="text-muted-foreground px-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
			Display
		</h3>
		<div class="bg-card border-border divide-border/60 divide-y overflow-hidden rounded-xl border">
			{@render selectRow(
				'LaTeX grammar',
				'The parser that drives syntax highlighting.',
				grammarOpts,
				settings.grammar,
				(v) => (settings.grammar = v as LatexGrammar)
			)}
			{@render selectRow(
				'Editor font',
				'Monospace typeface for the editing surface.',
				fontOpts,
				settings.font,
				(v) => (settings.font = v as EditorFont)
			)}
			<div class="px-4 py-3.5">
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
		</div>
	</section>

	<section class="flex flex-col gap-2.5">
		<h3 class="text-muted-foreground px-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
			Compilation
		</h3>
		<div class="bg-card border-border divide-border/60 divide-y overflow-hidden rounded-xl border">
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
		</div>
	</section>
</div>
