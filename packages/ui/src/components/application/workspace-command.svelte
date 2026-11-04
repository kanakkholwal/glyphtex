<script lang="ts">
	import {
		Command,
		CommandDialog,
		CommandEmpty,
		CommandFooter,
		CommandGroup,
		CommandHeader,
		CommandHint,
		CommandInput,
		CommandItem,
		CommandList,
		CommandSeparator
	} from "@glyphtex/ui/command";
	import type { Project } from "@glyphtex/ui/projects";
	import { settings } from "@glyphtex/ui/settings";
	import {
		IconClock,
		IconCloud,
		IconFileImport,
		IconFileText,
		IconFolder,
		IconFolderOpen,
		IconGitBranch,
		IconHome,
		IconMoon,
		IconPlus,
		IconSettings,
		IconStar,
		IconSun,
		IconTemplate
	} from "@tabler/icons-svelte";
	import type { Scope } from "./projects-home.svelte";

	interface Props {
		open: boolean;
		projects: Project[];
		scopeHrefs?: Partial<Record<Scope, string>>;
		settingsHref?: string;
		oncreate?: () => void;
		onimport?: () => void;
		onimportfolder?: () => void;
		onopenfolder?: () => void;
		onclone?: () => void;
		onopen?: (id: string) => void;
		navigate: (href: string) => void;
	}

	let {
		open = $bindable(false),
		projects,
		scopeHrefs,
		settingsHref,
		oncreate,
		onimport,
		onimportfolder,
		onopenfolder,
		onclone,
		onopen,
		navigate
	}: Props = $props();

	const destinations = $derived(
		[
			{ label: "Projects", href: scopeHrefs?.all, icon: IconHome },
			{ label: "Recent", href: scopeHrefs?.recent, icon: IconClock },
			{ label: "Starred", href: scopeHrefs?.starred, icon: IconStar },
			{ label: "Templates", href: scopeHrefs?.templates, icon: IconTemplate },
			{ label: "Settings", href: settingsHref, icon: IconSettings }
		].filter((d): d is { label: string; href: string; icon: typeof IconHome } => Boolean(d.href))
	);
	const recentFirst = $derived(projects.toSorted((a, b) => b.updatedAt - a.updatedAt));

	function run(action: (() => void) | undefined) {
		open = false;
		action?.();
	}
</script>

<CommandDialog
	bind:open
	variant="framed"
	label="Search GlyphTeX"
	description="Open a project, go somewhere or run an action"
>
	<Command variant="framed">
		<CommandHeader>
			<span class="text-foreground px-3 text-sm font-medium">Search</span>
		</CommandHeader>
		<CommandInput placeholder="Search projects, pages and actions…" />
		<CommandList>
			<CommandEmpty>Nothing matches.</CommandEmpty>
			{#if recentFirst.length > 0}
				<CommandGroup heading="Projects">
					{#each recentFirst as p (p.id)}
						<CommandItem value={`${p.name} ${p.id}`} keywords="open document project" onSelect={() => run(() => onopen?.(p.id))}>
							{#if p.root}<IconFolder />{:else if p.cloud}<IconCloud />{:else}<IconFileText />{/if}
							<span class="truncate">{p.name}</span>
						</CommandItem>
					{/each}
				</CommandGroup>
				<CommandSeparator />
			{/if}
			<CommandGroup heading="Actions">
				{#if oncreate}
					<CommandItem value="New project" keywords="create blank document" onSelect={() => run(oncreate)}>
						<IconPlus /> New project
					</CommandItem>
				{/if}
				{#if onimport}
					<CommandItem value="Import .zip" keywords="overleaf prism archive upload" onSelect={() => run(onimport)}>
						<IconFileImport /> Import .zip
					</CommandItem>
				{/if}
				{#if onimportfolder}
					<CommandItem value="Import folder" keywords="upload directory" onSelect={() => run(onimportfolder)}>
						<IconFolderOpen /> Import folder
					</CommandItem>
				{/if}
				{#if onopenfolder}
					<CommandItem value="Open folder" keywords="disk directory" onSelect={() => run(onopenfolder)}>
						<IconFolderOpen /> Open folder
					</CommandItem>
				{/if}
				{#if onclone}
					<CommandItem value="Clone repository" keywords="git github gitlab" onSelect={() => run(onclone)}>
						<IconGitBranch /> Clone repository
					</CommandItem>
				{/if}
				<CommandItem value="Switch theme" keywords="dark light mode appearance" onSelect={() => run(() => settings.toggle())}>
					{#if settings.resolved === 'dark'}<IconSun />{:else}<IconMoon />{/if}
					Switch to {settings.resolved === 'dark' ? 'light' : 'dark'} mode
				</CommandItem>
			</CommandGroup>
			<CommandSeparator />
			<CommandGroup heading="Go to">
				{#each destinations as d (d.label)}
					<CommandItem value={`Go to ${d.label}`} onSelect={() => run(() => navigate(d.href))}>
						<d.icon /> {d.label}
					</CommandItem>
				{/each}
			</CommandGroup>
		</CommandList>
		<!-- Esc already shows in the dialog rim, so the footer only teaches moving and opening. -->
		<CommandFooter class="flex items-center justify-start gap-4">
			<CommandHint keys={['↑', '↓']}>Move</CommandHint>
			<CommandHint keys={['↵']}>Open</CommandHint>
		</CommandFooter>
	</Command>
</CommandDialog>
