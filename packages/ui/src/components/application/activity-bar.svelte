<script lang="ts" module>
	export type ActivityView = 'files' | 'outline' | 'search' | 'git' | 'settings';
</script>

<script lang="ts">
	import { Button } from '@glyphx/ui/button';
	import { IconFiles, IconGitBranch, IconListTree, IconSearch, IconSettings } from '@tabler/icons-svelte';

	/**
	 * Rail — the left mode switcher (Explorer / Search / Source Control / Settings).
	 * No logo here (it lives in the top bar). Selection uses the Button
	 * `secondary` variant rather than a VS Code-style edge accent.
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

	const top: { id: ActivityView; label: string; icon: typeof IconFiles }[] = [
		{ id: 'files', label: 'Explorer', icon: IconFiles },
		{ id: 'outline', label: 'Outline', icon: IconListTree },
		{ id: 'search', label: 'Search', icon: IconSearch },
		{ id: 'git', label: 'Source Control', icon: IconGitBranch }
	];
</script>

<nav
	class="bg-card border-border flex w-12 shrink-0 flex-col items-center gap-1.5 py-2 {position ===
	'right'
		? 'border-l'
		: 'border-r'}"
	aria-label="Views"
>
	{#each top as item (item.id)}
		{@const Icon = item.icon}
		<Button
			variant={active === item.id ? 'brand_soft' : 'ghost'}
			size="icon-sm"
			title={item.label}
			aria-label={item.label}
			aria-pressed={active === item.id}
			onclick={() => onselect?.(item.id)}
		>
			<Icon class="size-5" />
		</Button>
	{/each}

	<div class="mt-auto">
		<Button
			variant={active === 'settings' ? 'brand_soft' : 'ghost'}
			size="icon-sm"
			title="Settings"
			aria-label="Settings"
			aria-pressed={active === 'settings'}
			onclick={() => onselect?.('settings')}
		>
			<IconSettings class="size-5" />
		</Button>
	</div>
</nav>
