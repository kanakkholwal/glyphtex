export const SITE_URL = "https://glyphtex.nexonauts.com";
export const SITE_NAME = "GlyphTeX";
export const SITE_TAGLINE = "A local-first LaTeX editor for academic writing";
export const DEFAULT_OG_IMAGE = "/og/default.svg";

export const AUTHOR = {
	name: "Kanak Kholwal",
	role: "Creator of GlyphTeX",
	bio: "Builds local-first writing tools. Wrote the Tectonic WASM engine that compiles LaTeX inside your browser tab.",
	avatar: "/authors/kanak.svg",
	url: `${SITE_URL}/about`,
	sameAs: [
		"https://github.com/kanakkholwal",
		"https://x.com/kanakkholwal",
		"https://www.linkedin.com/in/kanakkholwal"
	]
} as const;

export const ORG = {
	name: "Nexonauts",
	url: "https://nexonauts.com",
	logo: `${SITE_URL}/android-chrome-512x512.png`
} as const;

export const absolute = (path: string): string =>
	path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
