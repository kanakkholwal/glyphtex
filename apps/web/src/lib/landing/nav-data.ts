export type NavLink = { label: string; href: string; external?: boolean };

export const REPO_URL = "https://github.com/kanakkholwal/glyphtex";
export const CONTACT_EMAIL = "mailto:support@nexonauts.com";

const HOW: NavLink = { label: "How it works", href: "/#open" };
const COMPILE: NavLink = { label: "Compiling", href: "/#compile" };
const AUDIENCE: NavLink = { label: "For academics", href: "/#audience" };
const INSTITUTIONS: NavLink = { label: "Institutions", href: "/#institutions" };
const FAQ: NavLink = { label: "FAQ", href: "/#faq" };

const ENGINE: NavLink = { label: "The engine", href: "/engine" };

const DOWNLOAD: NavLink = { label: "Desktop app", href: "/download" };
const WORKSPACE: NavLink = { label: "Browser workspace", href: "/workspace" };
const PRIVACY: NavLink = { label: "Privacy", href: "/privacy" };

export const navLinks: NavLink[] = [
	// ENGINE, DOWNLOAD
];

export const footerCols: { title: string; links: NavLink[] }[] = [
	{ title: "Product", links: [HOW, COMPILE, AUDIENCE, INSTITUTIONS, FAQ] },
	{ title: "Get started", links: [WORKSPACE, ENGINE, DOWNLOAD] },
	{
		title: "Project",
		links: [
			{ label: "GitHub", href: REPO_URL, external: true },
			{ label: "Licence", href: `${REPO_URL}/blob/main/LICENSE`, external: true },
			PRIVACY,
			{ label: "Contact", href: CONTACT_EMAIL, external: true }
		]
	}
];

export type Social = { label: string; href: string; external: boolean };

// Two marks, not three: "Releases" is not a social account, and it duplicated
// the GitHub link two columns over.
export const footerSocials: Social[] = [
	{ label: "GitHub", href: REPO_URL, external: true },
	{ label: "Contact", href: CONTACT_EMAIL, external: true }
];
