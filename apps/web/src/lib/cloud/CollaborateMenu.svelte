<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import {
		DropdownMenu,
		DropdownMenuCheckboxItem,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from "@glyphtex/ui/dropdown-menu";
	import { live } from "@glyphtex/ui/live";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconChevronDown, IconMessage, IconUsers } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import type { DocumentMeta } from "$lib/documents/store";
	import ReviewPanel from "$lib/review/ReviewPanel.svelte";
	import { LiveControl } from "./live-control.svelte";

	// One entry for everything collaborative, so the title bar keeps a single Share button beside it.
	let { document }: { document: DocumentMeta } = $props();

	// svelte-ignore state_referenced_locally
	const liveControl = new LiveControl(() => document);
	let reviewOpen = $state(false);

	onMount(() => liveControl.loadInfo());

	$effect(() => {
		const reason = liveControl.endReason();
		if (!reason) return;
		live.config = null;
		toast.info(reason);
	});

	// Leaving the document must not leave the next one live.
	$effect(() => () => {
		live.config = null;
	});
</script>

{#if liveControl.available}
	<DropdownMenu>
		<DropdownMenuTrigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="sm" aria-label="Collaborate">
					<IconUsers />
					<span class="hidden lg:inline">Collaborate</span>
					{#if liveControl.on}
						<span class="bg-success size-1.5 rounded-full" aria-hidden="true"></span>
						<span class="sr-only">Live editing is on</span>
					{/if}
					<IconChevronDown class="size-3 opacity-50" />
				</Button>
			{/snippet}
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end" class="w-64">
			<DropdownMenuItem onSelect={() => (reviewOpen = true)}>
				<IconMessage />
				<span class="flex min-w-0 flex-col">
					<span>Review</span>
					<span class="text-muted-foreground text-xs">Comments, suggestions, versions, Git</span>
				</span>
			</DropdownMenuItem>
			<DropdownMenuCheckboxItem
				checked={liveControl.on}
				disabled={liveControl.supported === false}
				onCheckedChange={() => liveControl.toggle()}
			>
				<span class="flex min-w-0 flex-col" title={liveControl.disabledReason ?? liveControl.limitText}>
					<span>Edit live{liveControl.on && liveControl.status ? `: ${liveControl.status}` : ""}</span>
					<span class="text-muted-foreground text-xs">
						{liveControl.disabledReason
							? "Not enabled on this server"
							: "See cursors and edits as they happen"}
					</span>
				</span>
			</DropdownMenuCheckboxItem>
		</DropdownMenuContent>
	</DropdownMenu>
	<ReviewPanel {document} bind:open={reviewOpen} />
{/if}
