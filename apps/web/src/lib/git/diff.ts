export type DiffOp = { type: ' ' | '-' | '+'; line: string };

/** Above this the LCS table costs more memory than the diff is worth, so the
 *  changed region is reported as one wholesale replacement instead. */
const LCS_LIMIT = 2000;

const CONTEXT = 3;

function splitLines(text: string): string[] {
	if (text === '') return [];
	const lines = text.split('\n');
	// A trailing newline terminates the last line rather than starting a new one.
	if (lines[lines.length - 1] === '') lines.pop();
	return lines;
}

function lcsOps(a: string[], b: string[]): DiffOp[] {
	const n = a.length;
	const m = b.length;
	if (n > LCS_LIMIT || m > LCS_LIMIT) {
		return [
			...a.map((line): DiffOp => ({ type: '-', line })),
			...b.map((line): DiffOp => ({ type: '+', line }))
		];
	}

	const width = m + 1;
	const table = new Uint32Array((n + 1) * width);
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			table[i * width + j] =
				a[i] === b[j]
					? table[(i + 1) * width + j + 1] + 1
					: Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
		}
	}

	const ops: DiffOp[] = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (a[i] === b[j]) {
			ops.push({ type: ' ', line: a[i] });
			i++;
			j++;
		} else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
			ops.push({ type: '-', line: a[i++] });
		} else {
			ops.push({ type: '+', line: b[j++] });
		}
	}
	while (i < n) ops.push({ type: '-', line: a[i++] });
	while (j < m) ops.push({ type: '+', line: b[j++] });
	return ops;
}

/** Line diff as `[' '|'-'|'+', line]` operations, oldest-first. */
export function diffLines(original: string, modified: string): DiffOp[] {
	return lcsOps(splitLines(original), splitLines(modified));
}

/**
 * A `git diff`-style unified diff. `binary` renders the same one-line summary git
 * uses, since neither the panel nor the diff editor can show bytes.
 */
export function unifiedDiff(
	path: string,
	original: string,
	modified: string,
	opts: { binary?: boolean; added?: boolean; deleted?: boolean } = {}
): string {
	if (opts.binary) return `diff --git a/${path} b/${path}\nBinary files differ\n`;
	if (original === modified) return '';

	const ops = diffLines(original, modified);
	const header =
		`diff --git a/${path} b/${path}\n` +
		`--- ${opts.added ? '/dev/null' : `a/${path}`}\n` +
		`+++ ${opts.deleted ? '/dev/null' : `b/${path}`}\n`;

	const body = hunks(ops);
	return body ? header + body : '';
}

function hunks(ops: DiffOp[]): string {
	const changed = ops.map((o) => o.type !== ' ');
	if (!changed.includes(true)) return '';

	// Group changes that are within 2*CONTEXT of each other into one hunk, so their
	// context lines don't overlap into duplicated output.
	const groups: Array<[number, number]> = [];
	for (let i = 0; i < ops.length; i++) {
		if (!changed[i]) continue;
		const start = Math.max(0, i - CONTEXT);
		let end = i;
		while (end + 1 < ops.length) {
			const next = changed.indexOf(true, end + 1);
			if (next === -1 || next - end > CONTEXT * 2) break;
			end = next;
		}
		groups.push([start, Math.min(ops.length - 1, end + CONTEXT)]);
		i = end;
	}

	let oldLine = 1;
	let newLine = 1;
	const starts: Array<[number, number]> = [];
	for (let i = 0; i < ops.length; i++) {
		starts.push([oldLine, newLine]);
		if (ops[i].type !== '+') oldLine++;
		if (ops[i].type !== '-') newLine++;
	}

	let out = '';
	for (const [start, end] of groups) {
		const slice = ops.slice(start, end + 1);
		const oldCount = slice.filter((o) => o.type !== '+').length;
		const newCount = slice.filter((o) => o.type !== '-').length;
		const [oldStart, newStart] = starts[start];
		out += `@@ -${oldCount ? oldStart : 0},${oldCount} +${newCount ? newStart : 0},${newCount} @@\n`;
		for (const op of slice) out += `${op.type}${op.line}\n`;
	}
	return out;
}
