// Single source of truth for the marketing site chrome (Header + Footer).
// Both surfaces repeat the same links and external URLs; keep them here so
// a changed handle or section only edits in one place.

export type NavLink = { label: string; href: string; external?: boolean };

export const REPO_URL = 'https://github.com/kanakkholwal/glyphtex';
export const REPO_RELEASES_URL = `${REPO_URL}/releases`;
export const CONTACT_EMAIL = 'mailto:hello@glyphtex.app';

// In-page anchors live on the homepage. External routes hit /download and
// /workspace. Other marketing routes that trace-mvp has (pricing, blog,
// changelog, etc.) are not built in glyph-mvp yet, so we link to the repo
// or skip them.
//
// Every label names what the target section actually says. The old set had
// "Features" landing on "Step 1 · Open" and "Pricing" on "For the lab".
const HOW: NavLink = { label: 'How it works', href: '/#open' };
const COMPILE: NavLink = { label: 'Compiling', href: '/#compile' };
const AUDIENCE: NavLink = { label: 'For academics', href: '/#audience' };
// A route, not an anchor: the engineering story is the differentiator and needs
// somewhere to link to from outside the site.
const ENGINE: NavLink = { label: 'The engine', href: '/engine' };
// The institutions section absorbed the old #compare pricing band; both said
// "free for individuals, free for the institution".
const INSTITUTIONS: NavLink = { label: 'Institutions', href: '/#institutions' };
const FAQ: NavLink = { label: 'FAQ', href: '/#faq' };
// Labelled as a prototype rather than "Download": the desktop build is not
// released yet, so this must not read as a shipping product.
const DOWNLOAD: NavLink = { label: 'Desktop app (prototype)', href: '/download' };
const WORKSPACE: NavLink = { label: 'Open browser workspace', href: '/workspace' };

// Inline top-nav links, always visible on desktop. Four, not six: a marketing
// bar is a wayfinding aid, not a table of contents.
export const navLinks: NavLink[] = [HOW, ENGINE, INSTITUTIONS, FAQ];

export const footerCols: { title: string; links: NavLink[] }[] = [
	{
		title: 'Product',
		links: [HOW, COMPILE, AUDIENCE, ENGINE, INSTITUTIONS, FAQ, DOWNLOAD]
	},
	{
		title: 'Resources',
		links: [
			WORKSPACE,
			{ label: 'GitHub', href: REPO_URL, external: true },
			{ label: 'Releases', href: REPO_RELEASES_URL, external: true },
			{ label: 'License (GPLv3)', href: `${REPO_URL}/blob/main/LICENSE`, external: true }
		]
	},
	{
		title: 'Company',
		links: [
			{ label: 'Contact', href: CONTACT_EMAIL },
			{ label: 'Privacy', href: '/privacy' },
			{ label: 'Source code', href: REPO_URL, external: true }
		]
	}
];

export type Social = { label: string; href: string; external: boolean };

export const footerSocials: Social[] = [
	{ label: 'GitHub', href: REPO_URL, external: true },
	{ label: 'Releases', href: REPO_RELEASES_URL, external: true },
	// mailto: is external — it leaves the app. Flagged external so the
	// nav-data contract matches the URL semantics.
	{ label: 'Contact', href: CONTACT_EMAIL, external: true }
];
