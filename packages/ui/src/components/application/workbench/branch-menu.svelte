<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuGroup,
		DropdownMenuGroupHeading,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from "@glyphtex/ui/dropdown-menu";
	import {
		IconArrowDown,
		IconArrowUp,
		IconChevronDown,
		IconGitBranch,
		IconGitMerge
	} from "@tabler/icons-svelte";

	import type { GitHeadInfo } from "../git-panel.svelte";

	/** Branch state in the title bar. Read-only: it reports where HEAD is and hands
	 *  off to Source Control, which owns staging and remotes. */
	let { head, onopenpanel }: { head?: GitHeadInfo | null; onopenpanel?: () => void } = $props();

	const ahead = $derived(head?.ahead ?? 0);
	const behind = $derived(head?.behind ?? 0);
</script>

{#if head}
	<DropdownMenu>
		<DropdownMenuTrigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="sm"
					class="text-muted-foreground hover:text-foreground hidden max-w-44 gap-1.5 px-2 sm:inline-flex"
					title="Branch"
				>
					<IconGitBranch class="size-3.5 shrink-0" />
					<span class="truncate">{head.branch ?? 'HEAD'}</span>
					{#if behind}
						<span class="text-faint inline-flex shrink-0 items-center tabular-nums">
							<IconArrowDown class="size-3" />{behind}
						</span>
					{/if}
					{#if ahead}
						<span class="text-faint inline-flex shrink-0 items-center tabular-nums">
							<IconArrowUp class="size-3" />{ahead}
						</span>
					{/if}
					<IconChevronDown class="size-3 shrink-0 opacity-50" />
				</Button>
			{/snippet}
		</DropdownMenuTrigger>
		<DropdownMenuContent align="start" class="w-56">
			<DropdownMenuGroup>
				<DropdownMenuGroupHeading class="text-faint text-xs font-medium">
					{head.unborn ? 'No commits yet' : (head.upstream ?? 'No upstream')}
				</DropdownMenuGroupHeading>
				<DropdownMenuItem disabled>
					<IconGitBranch class="text-muted-foreground" />
					<span class="truncate font-mono text-xs">{head.branch ?? 'HEAD'}</span>
				</DropdownMenuItem>
				{#if head.merging}
					<DropdownMenuItem disabled>
						<IconGitMerge class="text-warning" />
						<span class="text-xs">Merge in progress</span>
					</DropdownMenuItem>
				{/if}
			</DropdownMenuGroup>
			<DropdownMenuSeparator />
			<DropdownMenuItem onSelect={() => onopenpanel?.()}>Open Source Control</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
{/if}
