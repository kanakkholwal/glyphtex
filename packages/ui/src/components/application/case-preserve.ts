type Pattern = 'upper' | 'lower' | 'capital' | 'mixed';

function classify(sample: string): Pattern {
	const letters = sample.replace(/[^a-zA-Z]/g, '');
	if (!letters) return 'mixed';
	if (letters === letters.toUpperCase()) return 'upper';
	if (letters === letters.toLowerCase()) return 'lower';
	// First letter upper, the remaining letters lower → capitalised.
	const rest = letters.slice(1);
	if (letters[0] === letters[0].toUpperCase() && rest === rest.toLowerCase()) return 'capital';
	return 'mixed';
}

/** Recases `replacement` to follow `sample` (VS Code's Preserve Case). Mixed-case or
 *  letterless samples pass the replacement through untouched. */
export function applyCase(sample: string, replacement: string): string {
	if (!replacement) return replacement;
	switch (classify(sample)) {
		case 'upper':
			return replacement.toUpperCase();
		case 'lower':
			return replacement.toLowerCase();
		case 'capital':
			return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
		default:
			return replacement;
	}
}
