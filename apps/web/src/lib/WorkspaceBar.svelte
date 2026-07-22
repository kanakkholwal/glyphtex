<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		IconArrowLeft,
		IconChevronDown,
		IconDownload,
		IconFilePlus,
		IconPhotoPlus
	} from '@tabler/icons-svelte';
	import { Button } from '@glyphx/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '@glyphx/ui/dropdown-menu';

	let {
		name,
		entry,
		texFiles = [],
		saving = false,
		onrename,
		onsetentry,
		onaddfiles,
		onexport
	}: {
		name: string;
		/** Path of the file compiled as the document root. */
		entry: string;
		/** Candidate root files, so the user can pick which one compiles. */
		texFiles?: string[];
		saving?: boolean;
		onrename?: (name: string) => void;
		onsetentry?: (path: string) => void;
		onaddfiles?: (accept: string) => void;
		onexport?: () => void;
	} = $props();

	let editing = $state(false);
	let draft = $state('');
	let field = $state<HTMLInputElement>();

	function start(): void {
		draft = name;
		editing = true;
		// Focus after the input exists, and select so typing replaces the name.
		queueMicrotask(() => field?.select());
	}

	function commit(): void {
		editing = false;
		const next = draft.trim();
		if (next && next !== name) onrename?.(next);
	}

	function onKey(event: KeyboardEvent): void {
		if (event.key === 'Enter') commit();
		else if (event.key === 'Escape') editing = false;
	}
</script>

<header
	class="border-border bg-background/80 flex h-11 shrink-0 items-center gap-2 border-b px-2 backdrop-blur-xl"
>
	<Button
		variant="ghost"
		size="sm"
		class="h-7 gap-1.5 px-2"
		href={resolve('/projects')}
		title="All documents"
	>
		<IconArrowLeft size={15} />
		<span class="hidden sm:inline">Documents</span>
	</Button>

	<div class="bg-border h-4 w-px" aria-hidden="true"></div>

	{#if editing}
		<!-- svelte-ignore a11y_autofocus -->
		<input
			bind:this={field}
			bind:value={draft}
			autofocus
			class="border-border bg-background focus-visible:ring-ring h-7 min-w-0 flex-1 rounded-md border px-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
			onblur={commit}
			onkeydown={onKey}
			aria-label="Document name"
		/>
	{:else}
		<button
			type="button"
			class="hover:bg-foreground/5 min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-sm font-medium"
			onclick={start}
			title="Rename document"
		>
			{name}
		</button>
	{/if}

	<span class="text-muted-foreground hidden text-xs sm:inline" aria-live="polite">
		{saving ? 'Saving…' : 'Saved'}
	</span>

	{#if texFiles.length > 1}
		<DropdownMenu>
			<DropdownMenuTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="sm"
						class="h-7 gap-1 px-2 text-xs"
						title="The file compiled as the document root"
					>
						<span class="text-muted-foreground hidden md:inline">Main</span>
						<span class="max-w-32 truncate font-mono">{entry}</span>
						<IconChevronDown size={13} />
					</Button>
				{/snippet}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" class="max-h-72 overflow-y-auto">
				{#each texFiles as path (path)}
					<DropdownMenuItem onclick={() => onsetentry?.(path)}>
						<span class="font-mono text-xs" class:font-semibold={path === entry}>{path}</span>
					</DropdownMenuItem>
				{/each}
			</DropdownMenuContent>
		</DropdownMenu>
	{/if}

	<Button
		variant="ghost"
		size="sm"
		class="h-7 gap-1.5 px-2 text-xs"
		onclick={() => onaddfiles?.('image/*')}
		title="Add images"
	>
		<IconPhotoPlus size={15} />
		<span class="hidden lg:inline">Image</span>
	</Button>

	<Button
		variant="ghost"
		size="sm"
		class="h-7 gap-1.5 px-2 text-xs"
		onclick={() => onaddfiles?.('')}
		title="Add files"
	>
		<IconFilePlus size={15} />
		<span class="hidden lg:inline">Files</span>
	</Button>

	<Button
		variant="ghost"
		size="sm"
		class="h-7 gap-1.5 px-2 text-xs"
		onclick={() => onexport?.()}
		title="Download as .zip"
	>
		<IconDownload size={15} />
		<span class="hidden lg:inline">Export</span>
	</Button>
</header>
