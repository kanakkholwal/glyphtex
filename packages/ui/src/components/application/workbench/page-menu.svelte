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
	import { toast } from '@glyphtex/ui/sonner';
	import {
		IconArrowsHorizontal,
		IconCode,
		IconDeviceDesktop,
		IconDots,
		IconEye,
		IconFolderOpen,
		IconFolderShare,
		IconLayoutColumns,
		IconLayoutRows,
		IconLink,
		IconMap,
		IconDeviceFloppy,
		IconMoon,
		IconNotes,
		IconPencil,
		IconSettings,
		IconSun,
		IconTextSize,
		IconTextWrap
	} from '@tabler/icons-svelte';

	import type { WorkbenchController } from './controller.svelte';
	import type { ViewMode } from './types';

	/** The document's own menu. Notion's shape: presentation first, because that
	 *  is the part people reach for mid-sentence: and mode-aware, because half of
	 *  a canvas menu means nothing while you're editing source. */
	let { ctrl, onrename }: { ctrl: WorkbenchController; onrename?: () => void } = $props();

	const files = $derived(ctrl.files);
	const layout = $derived(ctrl.layout);
	const visual = $derived(layout.docMode === 'visual');

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

	async function copyLink() {
		if (typeof location === 'undefined' || !navigator.clipboard) return;
		try {
			await navigator.clipboard.writeText(location.href);
			toast.success('Link copied');
		} catch {
			toast.error('Could not copy the link');
		}
	}
</script>

<DropdownMenu>
	<DropdownMenuTrigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="ghost"
				size="icon-sm"
				title="Document menu"
				aria-label="Document menu"
			>
				<IconDots />
			</Button>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="end" class="w-64">
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
			<DropdownMenuCheckboxItem
				checked={settings.minimap}
				onCheckedChange={(v) => (settings.minimap = v)}
			>
				<IconMap class="text-muted-foreground" /> Minimap
			</DropdownMenuCheckboxItem>
		{/if}

		<DropdownMenuSeparator />

		<!-- Save mode was a second dropdown in the editor's format row, alongside a
		     Minimap and Word wrap pair this menu already owns. -->
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
			<DropdownMenuSubContent class="w-40">
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

		<DropdownMenuSeparator />

		{#if onrename}
			<DropdownMenuItem onSelect={() => onrename?.()}>
				<IconPencil class="text-muted-foreground" /> Rename
			</DropdownMenuItem>
		{/if}
		<DropdownMenuItem onSelect={copyLink}>
			<IconLink class="text-muted-foreground" /> Copy link
		</DropdownMenuItem>
		{#if files.project?.revealInOS && files.projectRoot}
			<DropdownMenuItem onSelect={() => files.revealProject()}>
				<IconFolderShare class="text-muted-foreground" /> Reveal in file explorer
			</DropdownMenuItem>
		{/if}
		{#if ctrl.canOpenFolder}
			<DropdownMenuItem onSelect={() => ctrl.openFolder()}>
				<IconFolderOpen class="text-muted-foreground" /> Open folder…
			</DropdownMenuItem>
		{/if}
		{#if ctrl.onOpenProject}
			<DropdownMenuItem onSelect={() => ctrl.onOpenProject?.()}>
				<IconFolderOpen class="text-muted-foreground" /> Open another document…
			</DropdownMenuItem>
		{/if}
	</DropdownMenuContent>
</DropdownMenu>
