/** Validation for the public "Open in GlyphTeX" entry point. Pure, so server and client share it. */

export const OPEN_LIMITS = {
	snippetChars: 512 * 1024,
	nameChars: 120,
	uriChars: 2048,
	downloadBytes: 20 * 1024 * 1024
} as const;

export const ENGINES = ["pdflatex", "xelatex", "lualatex", "latex_dvipdf"] as const;

export type OpenSource =
	| { kind: "snippet"; text: string }
	| { kind: "url"; url: string; type: "tex" | "zip" };

export interface OpenRequest {
	name: string;
	main: string;
	engine: (typeof ENGINES)[number] | null;
	source: OpenSource;
}

export type OpenParse = { ok: true; request: OpenRequest } | { ok: false; error: string };

const MAIN = /^(?!.*\.\.)[\w.-]+(?:\/[\w.-]+){0,3}\.tex$/;
const PRIVATE_HOST = /^(localhost|.*\.(local|localhost|internal|lan|home|corp))$/i;

/** https only, no credentials, no IP literals or local names: it is fetched from the visitor's browser. */
export function safeRemoteUrl(raw: string): string | null {
	if (raw.length > OPEN_LIMITS.uriChars) return null;
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	if (url.protocol !== "https:" || url.username || url.password) return null;
	const host = url.hostname;
	if (
		PRIVATE_HOST.test(host) ||
		host.includes(":") ||
		/^[\d.]+$/.test(host) ||
		!host.includes(".")
	) {
		return null;
	}
	return url.toString();
}

/** Takes a getter so it works for query strings and form data alike. */
export function parseOpenParams(get: (key: string) => string | null): OpenParse {
	const snip = get("snip");
	const encoded = get("encoded_snip");
	const snipUri = get("snip_uri");
	const zipUri = get("zip_uri");
	const given = [snip, encoded, snipUri, zipUri].filter((v) => v !== null && v !== "");
	if (given.length !== 1) {
		return {
			ok: false,
			error: "Send exactly one of snip, encoded_snip, snip_uri or zip_uri."
		};
	}

	const name = (get("snip_name") ?? get("name") ?? "").replace(/[\u0000-\u001f]/g, "").trim();
	if (name.length > OPEN_LIMITS.nameChars)
		return { ok: false, error: "The project name is too long." };

	const mainRaw = (get("main_document") ?? "main.tex").trim();
	if (!MAIN.test(mainRaw))
		return { ok: false, error: "main_document must be a relative .tex path." };

	const engineRaw = (get("engine") ?? "").trim().toLowerCase();
	const engine = ENGINES.find((e) => e === engineRaw) ?? null;
	if (engineRaw && !engine)
		return { ok: false, error: `Unknown engine "${engineRaw.slice(0, 20)}".` };

	let source: OpenSource;
	if (snipUri || zipUri) {
		const url = safeRemoteUrl((snipUri || zipUri) as string);
		if (!url) return { ok: false, error: "The URL must be public https, with no credentials." };
		source = { kind: "url", url, type: snipUri ? "tex" : "zip" };
	} else {
		let text = (snip || encoded) as string;
		if (encoded) {
			try {
				text = decodeURIComponent(encoded);
			} catch {
				return { ok: false, error: "encoded_snip is not valid URL-encoded text." };
			}
		}
		if (text.length > OPEN_LIMITS.snippetChars)
			return { ok: false, error: "The snippet is too large." };
		if (text.includes("\u0000")) return { ok: false, error: "The snippet is not text." };
		source = { kind: "snippet", text };
	}
	return { ok: true, request: { name: name || "Imported", main: mainRaw, engine, source } };
}
