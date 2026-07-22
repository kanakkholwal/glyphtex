// Single source of truth for the marketing site chrome (Header + Footer).
// Both surfaces repeat the same links and external URLs; keep them here so
// a changed handle or section only edits in one place.

export type NavLink = { label: string; href: string; external?: boolean };

export const REPO_URL = 'https://github.com/kanakkholwal/glyphtex';
export const REPO_RELEASES_URL = `${REPO_URL}/releases`;
export const CONTACT_EMAIL = 'mailto:hello@glyphtex.app';

// In-page anchors live on the homepage. External routes hit /download and
// /editor, which the web app already exposes. Other marketing routes that
// trace-mvp has (pricing, blog, changelog, etc.) are not built in glyph-mvp
// yet, so we link to the repo or skip them.
const FEATURES: NavLink = { label: 'Features', href: '/#features' };
const WORKFLOW: NavLink = { label: 'Workflow', href: '/#workflow' };
const COMPARE: NavLink = { label: 'Compare', href: '/#compare' };
const FAQ: NavLink = { label: 'FAQ', href: '/#faq' };
const DOWNLOAD: NavLink = { label: 'Download', href: '/download' };
const EDITOR: NavLink = { label: 'Open editor', href: '/editor' };

// Inline top-nav links, always visible on desktop. Kept short for a minimal
// bar; everything else lives in the footer.
export const navLinks: NavLink[] = [FEATURES, WORKFLOW, COMPARE, FAQ];

export const footerCols: { title: string; links: NavLink[] }[] = [
	{
		title: 'Product',
		links: [FEATURES, WORKFLOW, COMPARE, FAQ, DOWNLOAD]
	},
	{
		title: 'Resources',
		links: [
			EDITOR,
			{ label: 'GitHub', href: REPO_URL, external: true },
			{ label: 'Releases', href: REPO_RELEASES_URL, external: true },
			{ label: 'License (GPLv3)', href: `${REPO_URL}/blob/main/LICENSE`, external: true }
		]
	},
	{
		title: 'Company',
		links: [
			{ label: 'Contact', href: CONTACT_EMAIL },
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
