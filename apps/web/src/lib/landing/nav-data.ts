export type NavLink = { label: string; href: string; external?: boolean };

export const REPO_SLUG = "kanakkholwal/glyphtex";
export const REPO_URL = `https://github.com/${REPO_SLUG}`;
export const CONTACT_EMAIL = "mailto:support@nexonauts.com";

const TRY: NavLink = { label: "Try it", href: "/#try" };
const WHY: NavLink = { label: "Why local", href: "/#why" };
const FAQ: NavLink = { label: "FAQ", href: "/#faq" };

const ENGINE: NavLink = { label: "The engine", href: "/engine" };
const ERRORS: NavLink = { label: "Fix a LaTeX error", href: "/errors" };

const DOWNLOAD: NavLink = { label: "Desktop app", href: "/download" };
const WORKSPACE: NavLink = { label: "Browser workspace", href: "/workspace" };
const TEMPLATES: NavLink = { label: "Templates", href: "/templates" };
const PRIVACY: NavLink = { label: "Privacy", href: "/privacy" };
const BLOG: NavLink = { label: "Blog", href: "/blog" };
const DOCS: NavLink = { label: "Docs", href: "/docs" };
const ABOUT: NavLink = { label: "About", href: "/about" };
const DEVELOPERS: NavLink = { label: "Developers", href: "/developers" };
const PACKAGES: NavLink = { label: "LaTeX packages", href: "/packages" };

export const navLinks: NavLink[] = [TEMPLATES, DOCS, { label: "Errors", href: "/errors" }, BLOG];

export const footerCols: { title: string; links: NavLink[] }[] = [
	{ title: "Product", links: [TRY, WHY, TEMPLATES, FAQ] },
	{ title: "Learn", links: [DOCS, ERRORS, PACKAGES, BLOG] },
	{ title: "Developers", links: [DEVELOPERS, ENGINE] },
	{ title: "Get started", links: [WORKSPACE, TEMPLATES, DOWNLOAD] },
	{
		title: "Project",
		links: [
			ABOUT,
			{ label: "GitHub", href: REPO_URL, external: true },
			{ label: "Licence", href: `${REPO_URL}/blob/main/LICENSE`, external: true },
			PRIVACY,
			{ label: "Contact", href: CONTACT_EMAIL, external: true }
		]
	}
];

export type Social = { label: string; href: string; external: boolean };

// Accounts only: "Releases" duplicated the GitHub link two columns over.
export const footerSocials: Social[] = [
	{ label: "GitHub", href: REPO_URL, external: true },
	{ label: "Portfolio", href: "https://kanakkholwal.eu.org", external: true },
	{ label: "Contact", href: CONTACT_EMAIL, external: true }
];
