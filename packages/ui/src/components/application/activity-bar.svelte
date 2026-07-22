<script lang="ts" module>
	export type ActivityView = 'files' | 'outline' | 'search' | 'git' | 'settings';
</script>

<script lang="ts">
	import { Button } from '@glyphx/ui/button';
	import { IconFiles, IconGitBranch, IconListTree, IconSearch, IconSettings } from '@tabler/icons-svelte';

	/**
	 * Rail — the left mode switcher (Explorer / Search / Source Control / Settings).
	 * No logo here (it lives in the top bar). Selection uses the Button
	 * `brand_soft` variant rather than a VS Code-style edge accent.
	 */
	let {
		active = 'files',
		onselect,
		position = 'left'
	}: {
		active?: ActivityView;
		onselect?: (view: ActivityView) => void;
		/** Which workbench edge the rail docks on — flips its divider border. */
		position?: 'left' | 'right';
	} = $props();

	// `label` is the caption under the icon and must survive a 56px rail, so it is
	// kept short; `title` carries the full name for the tooltip and screen reader.
	type Item = { id: ActivityView; label: string; title: string; icon: typeof IconFiles };

	const top: Item[] = [
		{ id: 'files', label: 'Files', title: 'Explorer', icon: IconFiles },
		{ id: 'outline', label: 'Outline', title: 'Outline', icon: IconListTree },
		{ id: 'search', label: 'Search', title: 'Search', icon: IconSearch },
		{ id: 'git', label: 'Git', title: 'Source Control', icon: IconGitBranch }
	];
	const bottom: Item = {
		id: 'settings',
		label: 'Settings',
		title: 'Settings',
		icon: IconSettings
	};

	const itemClass = 'h-auto w-full flex-col gap-1 rounded-md px-0.5 py-1.5';
</script>

<nav
	class="bg-card border-border flex w-14 shrink-0 flex-col items-center gap-1 px-1 py-2 {position ===
	'right'
		? 'border-l'
		: 'border-r'}"
	aria-label="Views"
>
	{#each [...top, bottom] as item (item.id)}
		{@const Icon = item.icon}
		<div class="w-full {item.id === 'settings' ? 'mt-auto' : ''}">
			<Button
				variant={active === item.id ? 'brand_soft' : 'ghost'}
				size="raw"
				class={itemClass}
				title={item.title}
				aria-label={item.title}
				aria-pressed={active === item.id}
				onclick={() => onselect?.(item.id)}
			>
				<Icon class="size-5" />
				<span class="w-full truncate text-center text-xs leading-none font-medium">
					{item.label}
				</span>
			</Button>
		</div>
	{/each}
</nav>
