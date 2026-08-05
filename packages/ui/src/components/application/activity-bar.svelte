<script lang="ts" module>
	export type ActivityView = 'files' | 'search' | 'git' | 'settings';
</script>

<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import { Tooltip, TooltipContent, TooltipTrigger } from '@glyphtex/ui/tooltip';
	import {
		IconFiles,
		IconFolderOpen,
		IconGitBranch,
		IconNotes,
		IconPlus,
		IconSearch,
		IconSettings
	} from '@tabler/icons-svelte';

	import { shortcutLabel } from './shortcuts';

	/** Icon-only mode switcher. App identity and menus live in the title bar. */
	let {
		active = 'files',
		onselect,
		position = 'left',
		notesOpen = false,
		ontogglenotes,
		onnewfile,
		onopenproject
	}: {
		active?: ActivityView;
		onselect?: (view: ActivityView) => void;
		/** Which workbench edge the rail docks on — flips its divider border. */
		position?: 'left' | 'right';
		notesOpen?: boolean;
		ontogglenotes?: () => void;
		onnewfile?: () => void;
		/** Absent on web, where there is no folder picker. */
		onopenproject?: () => void;
	} = $props();

	type Item = { id: ActivityView; label: string; icon: typeof IconFiles };

	const views: Item[] = [
		{ id: 'files', label: 'Project', icon: IconFiles },
		{ id: 'search', label: 'Search', icon: IconSearch },
		{ id: 'git', label: 'Source Control', icon: IconGitBranch }
	];
</script>

<nav
	class="bg-card border-border flex w-12 shrink-0 flex-col items-center gap-1 py-2 {position ===
	'right'
		? 'border-l'
		: 'border-r'}"
	aria-label="Views"
>
	{#each views as item (item.id)}
		{@const Icon = item.icon}
		<Tooltip delayDuration={300}>
			<TooltipTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={active === item.id ? 'brand_soft' : 'ghost'}
						size="icon-sm"
						aria-label={item.label}
						aria-pressed={active === item.id}
						onclick={() => onselect?.(item.id)}
					>
						<Icon class="size-5" />
					</Button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent side="right">{item.label}</TooltipContent>
		</Tooltip>
	{/each}

	{#if ontogglenotes}
		<Tooltip delayDuration={300}>
			<TooltipTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={notesOpen ? 'brand_soft' : 'ghost'}
						size="icon-sm"
						aria-label="Notes"
						aria-pressed={notesOpen}
						onclick={() => ontogglenotes?.()}
					>
						<IconNotes class="size-5" />
					</Button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent side="right">Notes · {shortcutLabel('toggle-notes')}</TooltipContent>
		</Tooltip>
	{/if}

	<div class="mt-auto flex flex-col items-center gap-1">
		{#if onnewfile}
			<Tooltip delayDuration={300}>
				<TooltipTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon-sm"
							aria-label="New file"
							onclick={() => onnewfile?.()}
						>
							<IconPlus class="size-5" />
						</Button>
					{/snippet}
				</TooltipTrigger>
				<TooltipContent side="right">New file · {shortcutLabel('new-file')}</TooltipContent>
			</Tooltip>
		{/if}
		{#if onopenproject}
			<Tooltip delayDuration={300}>
				<TooltipTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon-sm"
							aria-label="Open project"
							onclick={() => onopenproject?.()}
						>
							<IconFolderOpen class="size-5" />
						</Button>
					{/snippet}
				</TooltipTrigger>
				<TooltipContent side="right">Open project</TooltipContent>
			</Tooltip>
		{/if}

		<Tooltip delayDuration={300}>
			<TooltipTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={active === 'settings' ? 'brand_soft' : 'ghost'}
						size="icon-sm"
						aria-label="Settings"
						aria-pressed={active === 'settings'}
						onclick={() => onselect?.('settings')}
					>
						<IconSettings class="size-5" />
					</Button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent side="right">Settings</TooltipContent>
		</Tooltip>
	</div>
</nav>
