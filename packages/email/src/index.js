import { generated } from "./generated.js";

const escapeHtml = (s) =>
	s.replace(
		/[&<>"']/g,
		(c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot", "'": "#39" }[c]};`
	);

/** Fills `{{tokens}}` in a pre-rendered mail; values are HTML-escaped in the html part only. */
export function renderEmail(name, values) {
	const t = generated[name];
	if (!t) throw new Error(`Unknown email template "${name}"`);
	const fill = (src, esc) => src.replace(/\{\{(\w+)\}\}/g, (_, key) => esc(values[key] ?? ""));
	return { html: fill(t.html, escapeHtml), text: fill(t.text, (v) => v) };
}
