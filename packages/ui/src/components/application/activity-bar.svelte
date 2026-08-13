<script lang="ts" module>
	export type ActivityView = 'files' | 'search' | 'git';
</script>

<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import { Tooltip, TooltipContent, TooltipTrigger } from '@glyphtex/ui/tooltip';
	import {
		IconFiles,
		IconFolderOpen,
		IconGitBranch,
		IconPlus,
		IconSearch
	} from '@tabler/icons-svelte';

	import { shortcutLabel } from './shortcuts';

	/** Icon-only mode switcher. App identity and menus live in the title bar.
	 *  Active is a neutral fill, not a brand tint: blue reads as "link" on a nav
	 *  rail, and the fill already carries the state. */
	let {
		active = 'files',
		onselect,
		position = 'left',
		onnewfile,
		onopenproject
	}: {
		active?: ActivityView;
		onselect?: (view: ActivityView) => void;
		/** Which workbench edge the rail docks on — flips its divider border. */
		position?: 'left' | 'right';
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
	class="bg-sidebar border-sidebar-border flex w-12 shrink-0 flex-col items-center gap-1 py-2 {position ===
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
						variant={active === item.id ? 'secondary' : 'ghost'}
						size="icon-sm"
						aria-label={item.label}
						aria-pressed={active === item.id}
						onclick={() => onselect?.(item.id)}
					>
						<Icon class="size-4.5" />
					</Button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent side="right">{item.label}</TooltipContent>
		</Tooltip>
	{/each}

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
							<IconPlus class="size-4.5" />
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
							<IconFolderOpen class="size-4.5" />
						</Button>
					{/snippet}
				</TooltipTrigger>
				<TooltipContent side="right">Open project</TooltipContent>
			</Tooltip>
		{/if}
		<!-- Settings and Notes left the rail: both are read-and-dismiss surfaces, so
		     they open as a right-edge overlay from the document menu instead of
		     taking a column off the editor. -->
	</div>
</nav>
