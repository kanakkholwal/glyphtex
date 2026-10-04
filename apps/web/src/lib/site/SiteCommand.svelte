<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import { REPO_URL } from "$lib/landing/nav-data";
	import {
		Command,
		CommandDialog,
		CommandEmpty,
		CommandGroup,
		CommandInput,
		CommandItem,
		CommandList,
		CommandSeparator
	} from "@glyphtex/ui/command";
	import { settings } from "@glyphtex/ui/settings";
	import {
		IconArrowUpRight,
		IconBook,
		IconBrandGithub,
		IconBug,
		IconCpu,
		IconDeviceDesktop,
		IconFileText,
		IconHome,
		IconInfoCircle,
		IconLayoutGrid,
		IconMoon,
		IconPencil,
		IconShieldLock
	} from "@tabler/icons-svelte";
	import { onSiteCommandOpen } from "./command";

	let open = $state(false);

	const resolveAny = resolve as (route: string) => string;
	const pages: { label: string; href: string; icon: typeof IconHome; keywords?: string }[] = [
		{ label: "Home", href: "/", icon: IconHome },
		{ label: "Templates", href: "/templates", icon: IconLayoutGrid, keywords: "starter thesis" },
		{ label: "Docs", href: "/docs", icon: IconBook, keywords: "guide help" },
		{ label: "Fix a LaTeX error", href: "/errors", icon: IconBug, keywords: "undefined control" },
		{ label: "Blog", href: "/blog", icon: IconFileText, keywords: "articles" },
		{ label: "The engine", href: "/engine", icon: IconCpu, keywords: "tectonic wasm" },
		{ label: "Desktop app", href: "/download", icon: IconDeviceDesktop, keywords: "download" },
		{ label: "About", href: "/about", icon: IconInfoCircle },
		{ label: "Privacy", href: "/privacy", icon: IconShieldLock }
	];

	function go(href: string) {
		open = false;
		goto(resolveAny(href));
	}

	$effect(() => onSiteCommandOpen(() => (open = true)));
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			open = !open;
		}
	}}
/>

<CommandDialog bind:open label="Search GlyphTeX" description="Jump to a page or run an action">
	<Command>
		<CommandInput placeholder="Search pages and actions…" hint="Esc" />
		<CommandList>
			<CommandEmpty>Nothing matches.</CommandEmpty>
			<CommandGroup heading="Actions">
				<CommandItem
					value="Open the editor"
					keywords="workspace new project write"
					onSelect={() => {
						track('cta_clicked', { target: 'workspace', location: 'command' });
						go('/workspace');
					}}
				>
					<IconPencil />
					Open the editor
				</CommandItem>
				<CommandItem
					value="Switch theme"
					keywords="dark light mode"
					onSelect={() => {
						settings.toggle();
						open = false;
					}}
				>
					<IconMoon />
					Switch to {settings.resolved === 'dark' ? 'light' : 'dark'} mode
				</CommandItem>
				<CommandItem
					value="GitHub"
					keywords="source code repo star"
					onSelect={() => {
						open = false;
						window.open(REPO_URL, '_blank', 'noopener');
					}}
				>
					<IconBrandGithub />
					Source on GitHub
					<IconArrowUpRight class="ml-auto text-muted-foreground" />
				</CommandItem>
			</CommandGroup>
			<CommandSeparator />
			<CommandGroup heading="Pages">
				{#each pages as p (p.href)}
					<CommandItem value={p.label} keywords={p.keywords} onSelect={() => go(p.href)}>
						<p.icon />
						{p.label}
					</CommandItem>
				{/each}
			</CommandGroup>
		</CommandList>
	</Command>
</CommandDialog>
