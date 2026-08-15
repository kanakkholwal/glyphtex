<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import {
		DropdownMenu,
		DropdownMenuCheckboxItem,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuRadioGroup,
		DropdownMenuRadioItem,
		DropdownMenuSeparator,
		DropdownMenuSub,
		DropdownMenuSubContent,
		DropdownMenuSubTrigger,
		DropdownMenuTrigger
	} from '@glyphtex/ui/dropdown-menu';
	import {
		AUTO_SAVE_LABELS,
		DOC_FONT_LABELS,
		DOC_FONT_STACKS,
		settings,
		type Appearance,
		type AutoSaveMode,
		type DocFont
	} from '@glyphtex/ui/settings';
	import {
		IconArrowsHorizontal,
		IconCode,
		IconDeviceDesktop,
		IconDeviceFloppy,
		IconDots,
		IconEye,
		IconLayoutBottombar,
		IconLayoutColumns,
		IconLayoutRows,
		IconMoon,
		IconNotes,
		IconSettings,
		IconSun,
		IconTextSize,
		IconTextWrap
	} from '@tabler/icons-svelte';

	import type { WorkbenchController } from './controller.svelte';
	import type { ViewMode } from './types';

	/** How *this view* is presented, and nothing else. Mode-aware, because half of a
	 *  canvas menu means nothing while you're editing source. Anything that acts on
	 *  the document itself lives on the document's own breadcrumb node. */
	let { ctrl }: { ctrl: WorkbenchController } = $props();

	const layout = $derived(ctrl.layout);
	const visual = $derived(ctrl.docMode === 'visual');

	const fonts: DocFont[] = ['default', 'serif', 'mono'];
	const layouts: { value: ViewMode; label: string; icon: typeof IconEye }[] = [
		{ value: 'editor', label: 'Source', icon: IconCode },
		{ value: 'split', label: 'Split', icon: IconLayoutColumns },
		{ value: 'preview', label: 'PDF', icon: IconEye }
	];

	const autoSaveModes: AutoSaveMode[] = ['off', 'afterDelay', 'onFocusChange'];

	const appearances: { value: Appearance; label: string; icon: typeof IconSun }[] = [
		{ value: 'light', label: 'Light', icon: IconSun },
		{ value: 'dark', label: 'Dark', icon: IconMoon },
		{ value: 'system', label: 'System', icon: IconDeviceDesktop }
	];
	const AppearanceIcon = $derived(
		appearances.find((a) => a.value === settings.appearance)?.icon ?? IconDeviceDesktop
	);

	const tile =
		'flex flex-1 flex-col items-center gap-1 rounded-md py-2 transition-colors cursor-pointer';
</script>

<DropdownMenu>
	<DropdownMenuTrigger>
		{#snippet child({ props })}
			<!-- No Tooltip wrapper: nesting a second trigger primitive here spreads its
			     own handlers over the menu's and the dropdown stops opening. -->
			<Button {...props} variant="ghost" size="icon-sm" title="View options" aria-label="View options">
				<IconDots />
			</Button>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="end" class="w-56">
		<!-- Same three-tile slot in both modes: typeface in Visual, layout in
		     LaTeX. Keeping the shape stable is why the layout switch could come out
		     of the bar: the menu opens to the same geometry either way. -->
		{#if visual}
			<div class="flex gap-1.5 px-1 pt-1 pb-2" role="radiogroup" aria-label="Document font">
				{#each fonts as font (font)}
					{@const active = settings.docFont === font}
					<button
						class="{tile} {active ? 'bg-accent' : 'hover:bg-accent/60'}"
						role="radio"
						aria-checked={active}
						onclick={() => (settings.docFont = font)}
					>
						<span
							class="text-xl leading-none {active ? 'text-brand' : 'text-foreground'}"
							style:font-family={DOC_FONT_STACKS[font]}
						>
							Ag
						</span>
						<span class="text-muted-foreground text-[11px]">{DOC_FONT_LABELS[font]}</span>
					</button>
				{/each}
			</div>

			<DropdownMenuCheckboxItem
				checked={settings.docSmallText}
				onCheckedChange={(v) => (settings.docSmallText = v)}
			>
				<IconTextSize class="text-muted-foreground" /> Small text
			</DropdownMenuCheckboxItem>
			<DropdownMenuCheckboxItem
				checked={settings.docFullWidth}
				onCheckedChange={(v) => (settings.docFullWidth = v)}
			>
				<IconArrowsHorizontal class="text-muted-foreground" /> Full width
			</DropdownMenuCheckboxItem>
		{:else}
			<div class="flex gap-1.5 px-1 pt-1 pb-2" role="radiogroup" aria-label="Layout">
				{#each layouts as item (item.value)}
					{@const active = layout.viewMode === item.value}
					{@const Icon = item.icon}
					<button
						class="{tile} {active ? 'bg-accent' : 'hover:bg-accent/60'}"
						role="radio"
						aria-checked={active}
						onclick={() => (layout.viewMode = item.value)}
					>
						<Icon class="size-5 {active ? 'text-brand' : 'text-foreground'}" />
						<span class="text-muted-foreground text-[11px]">{item.label}</span>
					</button>
				{/each}
			</div>

			{#if layout.viewMode === 'split'}
				{@const stacked = layout.splitDir === 'vertical'}
				<DropdownMenuItem
					onSelect={() => (layout.splitDir = stacked ? 'horizontal' : 'vertical')}
					closeOnSelect={false}
				>
					{#if stacked}
						<IconLayoutColumns class="text-muted-foreground" /> Side by side
					{:else}
						<IconLayoutRows class="text-muted-foreground" /> Stack vertically
					{/if}
				</DropdownMenuItem>
			{/if}
			<DropdownMenuCheckboxItem
				checked={settings.lineWrapping}
				onCheckedChange={(v) => (settings.lineWrapping = v)}
			>
				<IconTextWrap class="text-muted-foreground" /> Wrap long lines
			</DropdownMenuCheckboxItem>
		{/if}

		<DropdownMenuSeparator />

		<!-- Save mode was a second dropdown in the editor's format row, alongside the
		     Word wrap toggle this menu already owns. -->
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				<IconDeviceFloppy class="text-muted-foreground" /> Save
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent class="w-44">
				<DropdownMenuRadioGroup
					value={settings.autoSave}
					onValueChange={(v) => (settings.autoSave = v as AutoSaveMode)}
				>
					{#each autoSaveModes as mode (mode)}
						<DropdownMenuRadioItem value={mode}>{AUTO_SAVE_LABELS[mode]}</DropdownMenuRadioItem>
					{/each}
				</DropdownMenuRadioGroup>
			</DropdownMenuSubContent>
		</DropdownMenuSub>

		<!-- Its only other mouse target is the compile status button, which isn't
		     rendered until an engine is installed. -->
		<DropdownMenuCheckboxItem
			checked={ctrl.compile.showProblems}
			onCheckedChange={(v) => (ctrl.compile.showProblems = v)}
		>
			<IconLayoutBottombar class="text-muted-foreground" /> Bottom panel
		</DropdownMenuCheckboxItem>
		<DropdownMenuItem onSelect={() => layout.toggleRightPanel('notes')}>
			<IconNotes class="text-muted-foreground" /> Notes
		</DropdownMenuItem>
		<DropdownMenuItem onSelect={() => layout.toggleRightPanel('settings')}>
			<IconSettings class="text-muted-foreground" /> Settings
		</DropdownMenuItem>
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				<AppearanceIcon class="text-muted-foreground" /> Appearance
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent class="w-44">
				<DropdownMenuRadioGroup
					value={settings.appearance}
					onValueChange={(v) => (settings.appearance = v as Appearance)}
				>
					{#each appearances as option (option.value)}
						<DropdownMenuRadioItem value={option.value}>{option.label}</DropdownMenuRadioItem>
					{/each}
				</DropdownMenuRadioGroup>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	</DropdownMenuContent>
</DropdownMenu>
