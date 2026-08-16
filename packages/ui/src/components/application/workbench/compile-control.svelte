<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { ButtonGroup } from "@glyphtex/ui/button-group";
	import {
		DropdownMenu,
		DropdownMenuCheckboxItem,
		DropdownMenuContent,
		DropdownMenuGroup,
		DropdownMenuGroupHeading,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuShortcut,
		DropdownMenuTrigger
	} from "@glyphtex/ui/dropdown-menu";
	import { settings } from "@glyphtex/ui/settings";
	import {
		IconAlertTriangleFilled,
		IconCheck,
		IconChevronDown,
		IconLoader2,
		IconPlayerPlayFilled,
		IconTarget
	} from "@tabler/icons-svelte";

	import { shortcutLabel } from "../shortcuts";
	import type { WorkbenchController } from "./controller.svelte";

	/** Build the document: the action, its live status, and what it builds from.
	 *  The status is the control that opens the log it is summarising. */
	let { ctrl }: { ctrl: WorkbenchController } = $props();

	const files = $derived(ctrl.files);
	const compile = $derived(ctrl.compile);

	// Candidate root files, so a multi-file document can pick which one compiles.
	const texFiles = $derived(files.files.filter((f) => f.name.endsWith(".tex")));
	const mainName = $derived(files.files.find((f) => f.id === files.mainId)?.name);
</script>

<div class="flex shrink-0 items-center gap-1.5">
	<!-- Fixed box, right-aligned, tabular digits: the label runs from "Compiling…"
	     to "Compiled in 1.1s" and back, and it must not push the build button. -->
	<button
		class="hover:bg-accent hidden w-[9.5rem] items-center justify-end gap-1.5 rounded-md px-2 py-1 text-xs tabular-nums transition-colors lg:inline-flex {compile.compileStatus ===
		'error'
			? 'text-destructive'
			: 'text-muted-foreground'}"
		title="Show the compile log"
		aria-pressed={compile.showProblems}
		onclick={() => (compile.showProblems = !compile.showProblems)}
	>
		{#if compile.compiling}
			<IconLoader2 size={14} class="shrink-0 animate-spin" />
		{:else if compile.compileStatus === 'error'}
			<IconAlertTriangleFilled size={14} class="shrink-0" />
		{:else if compile.compileStatus === 'success'}
			<IconCheck size={14} class="text-success shrink-0" />
		{/if}
		<span class="truncate whitespace-nowrap">{compile.compileLabel}</span>
	</button>

	<ButtonGroup>
		<!-- `min-w` covers the widest of Compile / Recompile / Compiling…, so the
		     caret beside it holds still while a build runs. -->
		<Button
			size="sm"
			class="h-8 pl-2.5 sm:min-w-[7.25rem]"
			disabled={compile.compiling}
			title="Compile ({shortcutLabel('compile')})"
			onclick={() => compile.runCompile(true)}
		>
			{#if compile.compiling}
				<IconLoader2 class="animate-spin" />
			{:else}
				<IconPlayerPlayFilled />
			{/if}
			<span class="hidden sm:inline">
				{compile.compiling ? 'Compiling…' : compile.pdfBytes ? 'Recompile' : 'Compile'}
			</span>
		</Button>
		<DropdownMenu>
			<DropdownMenuTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						size="icon-sm"
						class="h-8"
						title="Compile options"
						aria-label="Compile options"
					>
						<IconChevronDown class="size-4" />
					</Button>
				{/snippet}
			</DropdownMenuTrigger>
			<!-- Build settings only. "Compile once" and "Sync to PDF" used to sit here
			     too, next to the button that already compiles and beside ⌘J. -->
			<DropdownMenuContent align="end" class="w-56">
				<DropdownMenuCheckboxItem
					checked={settings.autoCompile}
					onCheckedChange={(v) => (settings.autoCompile = v)}
				>
					Live compile
					<DropdownMenuShortcut>Recompiles as you type</DropdownMenuShortcut>
				</DropdownMenuCheckboxItem>

				<DropdownMenuSeparator />
				<!-- GroupHeading throws outside a Group, which takes the whole menu
				     down with it: keep the two together. -->
				<DropdownMenuGroup>
					<DropdownMenuGroupHeading class="text-faint text-xs font-medium">
						Main file
					</DropdownMenuGroupHeading>
					{#if texFiles.length > 1}
						{#each texFiles as file (file.id)}
							<DropdownMenuItem onSelect={() => files.setMain(file.id)}>
								<IconTarget class={file.id === files.mainId ? 'text-brand' : 'opacity-0'} />
								<span class="truncate font-mono text-xs">{file.name}</span>
							</DropdownMenuItem>
						{/each}
					{:else}
						<DropdownMenuItem disabled>
							<IconTarget class="text-brand" />
							<span class="truncate font-mono text-xs">{mainName ?? 'None'}</span>
						</DropdownMenuItem>
					{/if}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	</ButtonGroup>
</div>
