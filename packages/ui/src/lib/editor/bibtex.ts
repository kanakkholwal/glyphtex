/**
 * A small BibTeX reader, for citation completion.
 *
 * This exists to answer one question — "what keys can I cite, and what are
 * they?" — so it reads entry types, keys and a few display fields, and
 * deliberately does not try to be a full BibTeX implementation. It does not
 * expand `@string` abbreviations, resolve crossrefs, or interpret TeX inside
 * field values beyond stripping the braces people use for capitalisation.
 *
 * It is written to never throw on malformed input: a half-typed `.bib` file is
 * the normal case while someone is editing one, and losing every suggestion
 * because the last entry is incomplete would be worse than parsing what we can.
 */

export type BibEntry = {
	/** Citation key — what goes inside `\cite{}`. */
	key: string;
	/** Entry type without the `@`, lowercased: `article`, `book`, … */
	type: string;
	title?: string;
	author?: string;
	year?: string;
	/** File the entry came from, for the completion detail line. */
	source?: string;
};

/** Entry types that declare no citation key and must be skipped. */
const NON_ENTRY = new Set(["comment", "preamble", "string"]);

/** Fields worth showing in a suggestion; everything else is ignored. */
const INTERESTING = new Set(["title", "author", "year", "date", "editor", "booktitle"]);

/**
 * Read a brace-delimited value starting at `open` (index of `{`), returning the
 * contents and the index just past the closing brace. Tracks nesting so
 * `title = {The {TeX}book}` survives, and honours backslash escapes.
 */
function readBraced(text: string, open: number): { value: string; end: number } {
	let depth = 0;
	for (let i = open; i < text.length; i++) {
		const ch = text[i];
		if (ch === "\\") {
			i++;
			continue;
		}
		if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) return { value: text.slice(open + 1, i), end: i + 1 };
		}
	}
	// Unterminated — take the rest, so a file being typed still yields entries.
	return { value: text.slice(open + 1), end: text.length };
}

/** Read a `"…"` value, honouring backslash escapes. */
function readQuoted(text: string, open: number): { value: string; end: number } {
	for (let i = open + 1; i < text.length; i++) {
		if (text[i] === "\\") {
			i++;
			continue;
		}
		if (text[i] === '"') return { value: text.slice(open + 1, i), end: i + 1 };
	}
	return { value: text.slice(open + 1), end: text.length };
}

/** Collapse the braces and whitespace BibTeX uses for capitalisation control. */
function clean(value: string): string {
	return value
		.replace(/[{}]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Parse the body of one entry (everything inside the outer braces) into its key
 * and display fields. The key is whatever precedes the first comma.
 */
function parseEntryBody(body: string): { key: string; fields: Record<string, string> } {
	const firstComma = body.indexOf(",");
	if (firstComma === -1) return { key: body.trim(), fields: {} };

	const key = body.slice(0, firstComma).trim();
	const fields: Record<string, string> = {};

	let i = firstComma + 1;
	while (i < body.length) {
		// name =
		const nameMatch = /\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*/.exec(body.slice(i));
		if (!nameMatch) break;
		const name = nameMatch[1].toLowerCase();
		i += nameMatch[0].length;

		let value: string;
		if (body[i] === "{") {
			const read = readBraced(body, i);
			value = read.value;
			i = read.end;
		} else if (body[i] === '"') {
			const read = readQuoted(body, i);
			value = read.value;
			i = read.end;
		} else {
			// Bare value: a number, or an @string abbreviation we do not expand.
			const bare = /^[^,]*/.exec(body.slice(i))?.[0] ?? "";
			value = bare;
			i += bare.length;
		}

		if (INTERESTING.has(name)) fields[name] = clean(value);

		// Skip to just past the next comma.
		const comma = body.indexOf(",", i);
		if (comma === -1) break;
		i = comma + 1;
	}

	return { key, fields };
}

/** Parse a `.bib` file into its entries. Never throws. */
export function parseBib(text: string, source?: string): BibEntry[] {
	const entries: BibEntry[] = [];
	let i = 0;

	while (i < text.length) {
		const at = text.indexOf("@", i);
		if (at === -1) break;

		const typeMatch = /^@\s*([a-zA-Z]+)\s*[{(]/.exec(text.slice(at));
		if (!typeMatch) {
			i = at + 1;
			continue;
		}

		const type = typeMatch[1].toLowerCase();
		const open = at + typeMatch[0].length - 1;
		// `@article(...)` is legal too, but parenthesised entries are vanishingly
		// rare and brace-counting them separately is not worth it — skip them.
		if (text[open] !== "{") {
			i = at + typeMatch[0].length;
			continue;
		}

		const { value: body, end } = readBraced(text, open);
		i = end;

		if (NON_ENTRY.has(type)) continue;

		const { key, fields } = parseEntryBody(body);
		if (!key) continue;

		entries.push({
			key,
			type,
			title: fields.title || fields.booktitle,
			author: fields.author || fields.editor,
			// biblatex prefers `date`; take the leading year out of it.
			year: fields.year || /^(\d{4})/.exec(fields.date ?? "")?.[1],
			source,
		});
	}

	return entries;
}

/** One-line summary for a completion detail row. */
export function describeEntry(entry: BibEntry): string {
	const parts: string[] = [];
	if (entry.author) {
		// "Knuth, Donald E. and Lamport, Leslie" → "Knuth et al."
		const authors = entry.author.split(/\s+and\s+/);
		const first = authors[0].split(",")[0].trim();
		parts.push(authors.length > 1 ? `${first} et al.` : first);
	}
	if (entry.year) parts.push(entry.year);
	const who = parts.join(", ");
	if (entry.title && who) return `${entry.title} — ${who}`;
	return entry.title || who || entry.type;
}
