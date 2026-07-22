<script lang="ts" module>
	export type ActivityView = 'files' | 'outline' | 'search' | 'git' | 'settings';
</script>

<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import { Logo } from '@glyphtex/ui/logo';
	import { Tooltip, TooltipContent, TooltipTrigger } from '@glyphtex/ui/tooltip';
	import {
		IconCommand,
		IconFiles,
		IconFolderOpen,
		IconGitBranch,
		IconListTree,
		IconPlus,
		IconSearch,
		IconSettings
	} from '@tabler/icons-svelte';

	import AppMenu, { type Menu } from './app-menu.svelte';

	/**
	 * Rail — the left mode switcher, icon-only with a tooltip per item. Also
	 * carries the app identity (logo + the File/Edit/View menus) and the bottom
	 * actions, so the document header stays a document header.
	 */
	let {
		active = 'files',
		onselect,
		position = 'left',
		menus = [],
		homeHref = '/',
		homeLabel = 'Home',
		onnewfile,
		onopenproject
	}: {
		active?: ActivityView;
		onselect?: (view: ActivityView) => void;
		/** Which workbench edge the rail docks on — flips its divider border. */
		position?: 'left' | 'right';
		/** Application menus, shown under the rail's menu button. */
		menus?: Menu[];
		/** Where the logo links. Hosts pass their document list; '/' is the fallback. */
		homeHref?: string;
		/** Hover label for the logo, e.g. "Documents". */
		homeLabel?: string;
		onnewfile?: () => void;
		/** Absent on web, where there is no folder picker. */
		onopenproject?: () => void;
	} = $props();

	type Item = { id: ActivityView; label: string; icon: typeof IconFiles };

	const views: Item[] = [
		{ id: 'files', label: 'Files', icon: IconFiles },
		{ id: 'outline', label: 'Outline', icon: IconListTree },
		{ id: 'search', label: 'Search', icon: IconSearch },
		{ id: 'git', label: 'Source Control', icon: IconGitBranch }
	];
</script>

<nav
	class="bg-card border-border flex w-14 shrink-0 flex-col items-center gap-1 py-2 {position ===
	'right'
		? 'border-l'
		: 'border-r'}"
	aria-label="Views"
>
	<!-- The logo is the way back to the document list, which is not guessable from
	     the mark alone — hence the label on hover. -->
	<span title={homeLabel}>
		<Logo href={homeHref} text={false} size="md" viewTransitionName="app-logo" />
	</span>

	<div class="bg-border my-1.5 h-px w-6"></div>

	{#each views as item (item.id)}
		{const Icon = item.icon}
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

	<!-- Bottom actions: create, open, configure. -->
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
				<TooltipContent side="right">New file</TooltipContent>
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
		<!-- Native `title`, not the styled Tooltip: this button is already a
		     DropdownMenu trigger, and merging both triggers' props onto one element
		     lets one set of handlers clobber the other. -->
		<AppMenu {menus}>
			{#snippet trigger({ props })}
				<Button
					{...props}
					variant="ghost"
					size="icon-sm"
					title="Menu"
					aria-label="Application menu"
				>
					<IconCommand class="size-5" />
				</Button>
			{/snippet}
		</AppMenu>

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
