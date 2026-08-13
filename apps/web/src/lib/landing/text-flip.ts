const NBSP = ' ';

/** Both sides of the pill's `px-[0.14em]`; border-box means width must add it back. */
export const PILL_PADDING_EM = 0.28;

/** Display glyphs for a word, one per animated box. */
export function splitLetters(word: string): string[] {
	// A literal space collapses at the edge of an inline-block letter, so
	// "lecture notes" would otherwise render as "lecturenotes".
	return [...word].map((letter) => (letter === ' ' ? NBSP : letter));
}

export function nextIndex(current: number, length: number): number {
	return length > 0 ? (current + 1) % length : 0;
}

/** CSS width for the pill; `auto` until the active word has been measured. */
export function pillWidth(measured: number): string {
	return measured > 0 ? `calc(${measured}px + ${PILL_PADDING_EM}em)` : 'auto';
}
