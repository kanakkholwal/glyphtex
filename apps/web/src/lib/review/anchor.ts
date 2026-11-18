export interface Anchor {
	from: number;
	to: number;
	/** The text the range covered when it was made; how we find it again after edits. */
	quote: string | null;
}

/**
 * Where an old range lives in the current text: the same offsets if the quote still sits there,
 * else the closest occurrence of the quote, else null (the text it pointed at is gone).
 */
export function locate(text: string, anchor: Anchor): { from: number; to: number } | null {
	const { from, to, quote } = anchor;
	if (!quote) {
		return from <= text.length ? { from, to: Math.min(to, text.length) } : null;
	}
	if (text.slice(from, to) === quote) return { from, to };
	let best: number | null = null;
	for (let i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + 1)) {
		if (best === null || Math.abs(i - from) < Math.abs(best - from)) best = i;
	}
	return best === null ? null : { from: best, to: best + quote.length };
}
