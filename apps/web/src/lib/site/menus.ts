import type { art } from "$lib/landing/art";
import {
	IconBook2,
	IconBug,
	IconBuildingCommunity,
	IconCpu,
	IconDeviceDesktop,
	IconEdit,
	IconFileZip,
	IconNews,
	IconPackage,
	IconServer,
	IconSchool,
	IconSwitchHorizontal,
	IconTemplate,
	IconTerminal2,
	IconUsersGroup
} from "@tabler/icons-svelte";

export type MenuItem = {
	label: string;
	desc: string;
	href: string;
	icon: typeof IconEdit;
};

export type MenuFeature = {
	title: string;
	desc: string;
	href: string;
	cta: string;
	art: keyof typeof art;
};

export type Menu = {
	label: string;
	feature: MenuFeature;
	items: MenuItem[];
	strip?: { label: string; links: { label: string; href: string }[] };
};

export const menus: Menu[] = [
	{
		label: "Product",
		feature: {
			title: "Write without an account",
			desc: "Open the editor and your document compiles right in the tab.",
			href: "/workspace",
			cta: "Open the editor",
			art: "page"
		},
		items: [
			{
				label: "Browser editor",
				desc: "Write and compile in a tab. No account.",
				href: "/workspace",
				icon: IconEdit
			},
			{
				label: "Templates",
				desc: "Theses, papers, CVs and slides that compile.",
				href: "/templates",
				icon: IconTemplate
			},
			{
				label: "Import from Overleaf",
				desc: "Drop the exported .zip and keep going.",
				href: "/compare/overleaf",
				icon: IconFileZip
			},
			{
				label: "Desktop app",
				desc: "An early prototype for Windows, macOS and Linux.",
				href: "/download",
				icon: IconDeviceDesktop
			}
		],
		strip: {
			label: "Switching",
			links: [
				{ label: "Compare with Overleaf", href: "/compare/overleaf" },
				{ label: "Import a project", href: "/#import" }
			]
		}
	},
	{
		label: "Solutions",
		feature: {
			title: "One editor, any size of team",
			desc: "Start alone. Add co-authors, then admin controls, when you need them.",
			href: "/compare/overleaf",
			cta: "See how it compares",
			art: "people"
		},
		items: [
			{
				label: "Students and researchers",
				desc: "A thesis or paper with nothing to sign up for.",
				href: "/workspace",
				icon: IconSchool
			},
			{
				label: "Labs and co-authors",
				desc: "Live editing, comments, history and Git.",
				href: "/compare/overleaf",
				icon: IconUsersGroup
			},
			{
				label: "Universities and organizations",
				desc: "SSO, SCIM, sharing policy and an audit log, self-hosted.",
				href: "/for/universities",
				icon: IconBuildingCommunity
			}
		]
	},
	{
		label: "Learn",
		feature: {
			title: "Stuck on an error?",
			desc: "Plain-language fixes for the LaTeX errors that stop a build.",
			href: "/errors",
			cta: "Fix a LaTeX error",
			art: "page"
		},
		items: [
			{
				label: "Docs",
				desc: "Guides for writing, compiling and fixing LaTeX.",
				href: "/docs",
				icon: IconBook2
			},
			{
				label: "Fix a LaTeX error",
				desc: "Plain-language answers for errors that stop a build.",
				href: "/errors",
				icon: IconBug
			},
			{
				label: "LaTeX packages",
				desc: "What each package does and whether it works here.",
				href: "/packages",
				icon: IconPackage
			},
			{
				label: "Blog",
				desc: "Notes from building a LaTeX engine for the browser.",
				href: "/blog",
				icon: IconNews
			}
		]
	},
	{
		label: "Developers",
		feature: {
			title: "Compile LaTeX anywhere",
			desc: "A free command line tool and a WebAssembly engine on npm.",
			href: "/developers/glyphtex-cli",
			cta: "Read the CLI guide",
			art: "terminal"
		},
		items: [
			{
				label: "glyphtex CLI",
				desc: "Build, watch and check projects from a terminal.",
				href: "/developers/glyphtex-cli",
				icon: IconTerminal2
			},
			{
				label: "Compiler on npm",
				desc: "The WebAssembly engine as a JavaScript package.",
				href: "/developers/glyphtex-engine",
				icon: IconCpu
			},
			{
				label: "Self-host the server",
				desc: "Run accounts and sharing on your own infrastructure.",
				href: "/developers/self-hosting",
				icon: IconServer
			},
			{
				label: "Open in GlyphTeX",
				desc: "Link to a project from your own site or repository.",
				href: "/developers/open-in-glyphtex",
				icon: IconSwitchHorizontal
			}
		],
		strip: {
			label: "Build with",
			links: [
				{ label: "CLI", href: "/developers/glyphtex-cli" },
				{ label: "Engine", href: "/developers/glyphtex-engine" },
				{ label: "Self-hosting", href: "/developers/self-hosting" }
			]
		}
	}
];
