import type { Patch } from "./edit";
import type { Block, Span } from "./types";

// A `tabular` read as a grid. Only plain ones: a `\multicolumn`, `\multirow`,
// nested environment or `*{n}{…}` spec makes {@link readTable} return null.

export type TableCell = { text: string; span: Span };
export type TableRow = { cells: TableCell[]; ruleBefore: boolean };
export type TableGrid = {
	/** The whole `\begin{tabular}…\end{tabular}`, in document offsets. */
	span: Span;
	environment: string;
	/** One entry per column: `l`, `c`, `r`, or a sized spec such as `p{3cm}`. */
	columns: string[];
	/** The original spec used `|` separators, so a reprint keeps its rules. */
	borders: boolean;
	rows: TableRow[];
	ruleAfter: boolean;
};

export type ColumnAlign = "l" | "c" | "r";

const UNSUPPORTED = /\\(multicolumn|multirow|cline|begin)\b/;
const TABULAR = /\\begin\{(tabular\*?|tabularx|longtable)\}[ \t]*(?:\[[^\]]*\])?[ \t]*\{/;
const RULE = /^\\(hline|toprule|midrule|bottomrule)\b/;

/** Read the balanced `{…}` starting at `open`, which must be the brace itself. */
function group(text: string, open: number): { body: string; end: number } | null {
	let depth = 0;
	for (let i = open; i < text.length; i++) {
		if (text[i] === "\\") {
			i++;
			continue;
		}
		if (text[i] === "{") depth++;
		else if (text[i] === "}" && --depth === 0) return { body: text.slice(open + 1, i), end: i + 1 };
	}
	return null;
}

/** Split a column spec into one entry per column, dropping the rule separators. */
function columnsOf(spec: string): string[] | null {
	const out: string[] = [];
	for (let i = 0; i < spec.length; i++) {
		const char = spec[i];
		if (char === "|" || /\s/.test(char)) continue;
		// `*{3}{l}` and `@{…}` change the column count in ways this grid cannot
		// represent, so the whole table falls back to source editing.
		if (char === "*" || char === "@" || char === "!") return null;
		if ("lcrX".includes(char)) {
			out.push(char);
			continue;
		}
		if ("pmb".includes(char) && spec[i + 1] === "{") {
			const arg = group(spec, i + 1);
			if (!arg) return null;
			out.push(spec.slice(i, arg.end));
			i = arg.end - 1;
			continue;
		}
		return null;
	}
	return out.length ? out : null;
}

/** Cut the body into rows of cells, tracking brace depth so a `&` inside a
 *  `\textbf{a & b}` is not mistaken for a column separator. */
function scanRows(
	body: string,
	offset: number,
	columns: number
): { rows: TableRow[]; ruleAfter: boolean } | null {
	const rows: TableRow[] = [];
	let cells: { from: number; to: number }[] = [];
	let ruleBefore = false;
	let ruleAfter = false;
	let start = 0;
	let depth = 0;

	let overfull = false;

	const pushCell = (to: number) => cells.push({ from: start, to });
	const pushRow = (to: number) => {
		pushCell(to);
		const texts = cells.map((c) => ({
			text: body.slice(c.from, c.to).trim(),
			span: { from: offset + c.from, to: offset + c.to }
		}));
		// More cells than the spec declares: a reprint would drop the surplus, so
		// the whole table falls back to source editing instead.
		if (texts.length > columns) overfull = true;
		while (texts.length < columns)
			texts.push({ text: "", span: { from: offset + to, to: offset + to } });
		rows.push({ cells: texts.slice(0, columns), ruleBefore });
		cells = [];
		ruleBefore = false;
	};

	for (let i = 0; i < body.length; i++) {
		const char = body[i];
		if (char === "\\") {
			const rest = body.slice(i);
			const rule = RULE.exec(rest);
			if (rule && depth === 0) {
				// A rule between rows, not part of a cell: skip it and remember it.
				if (cells.length === 0 && body.slice(start, i).trim() === "") {
					ruleBefore = true;
					i += rule[0].length - 1;
					start = i + 1;
					ruleAfter = true;
					continue;
				}
			}
			if (rest.startsWith("\\\\") && depth === 0) {
				pushRow(i);
				i += 1;
				while (body[i + 1] === "*" || body[i + 1] === "[") {
					if (body[i + 1] === "[") {
						const close = body.indexOf("]", i);
						if (close === -1) return null;
						i = close;
					} else i++;
				}
				start = i + 1;
				ruleAfter = false;
				continue;
			}
			i++;
			continue;
		}
		if (char === "{") depth++;
		else if (char === "}") depth--;
		else if (char === "&" && depth === 0) {
			pushCell(i);
			start = i + 1;
		}
	}
	if (body.slice(start).trim() !== "" || cells.length) pushRow(body.length);
	return rows.length && !overfull ? { rows, ruleAfter } : null;
}

/** The grid inside a float, or null when it is not a shape we can edit. */
export function readTable(source: string, block: Block): TableGrid | null {
	const text = source.slice(block.span.from, block.span.to);
	const begin = TABULAR.exec(text);
	if (!begin) return null;
	const specStart = begin.index + begin[0].length - 1;
	const spec = group(text, specStart);
	if (!spec) return null;
	const columns = columnsOf(spec.body);
	if (!columns) return null;

	const environment = begin[1];
	const endTag = `\\end{${environment}}`;
	const endAt = text.lastIndexOf(endTag);
	if (endAt === -1 || endAt < spec.end) return null;

	const body = text.slice(spec.end, endAt);
	if (UNSUPPORTED.test(body) || body.includes("%")) return null;
	const scan = scanRows(body, block.span.from + spec.end, columns.length);
	if (!scan) return null;

	return {
		span: { from: block.span.from + begin.index, to: block.span.from + endAt + endTag.length },
		environment,
		columns,
		borders: spec.body.includes("|"),
		rows: scan.rows,
		ruleAfter: scan.ruleAfter
	};
}

export function printTable(grid: TableGrid): string {
	const spec = grid.borders ? `|${grid.columns.join("|")}|` : grid.columns.join(" ");
	const lines: string[] = [`\\begin{${grid.environment}}{${spec}}`];
	for (const row of grid.rows) {
		if (row.ruleBefore) lines.push("  \\hline");
		lines.push(`  ${row.cells.map((c) => c.text).join(" & ")} \\\\`);
	}
	if (grid.ruleAfter) lines.push("  \\hline");
	lines.push(`\\end{${grid.environment}}`);
	return lines.join("\n");
}

const reprint = (grid: TableGrid, rows: TableRow[], columns = grid.columns): Patch => ({
	...grid.span,
	insert: printTable({ ...grid, columns, rows })
});

const cell = (text: string): TableCell => ({ text, span: { from: 0, to: 0 } });

/** Patched over the cell's own span, so typing in a corner does not reformat
 *  rows nobody touched. */
export function setTableCell(
	grid: TableGrid,
	row: number,
	column: number,
	text: string
): Patch | null {
	const target = grid.rows[row]?.cells[column];
	if (!target) return null;
	// `&` would open a column that is not in the spec and `\\` would end the row.
	// Everything else passes through, so `\textbf{x}` in a cell still works.
	const safe = text
		.replace(/\\\\/g, " ")
		.replace(/(?<!\\)&/g, "\\&")
		.trim();
	if (safe === target.text) return null;
	return { ...target.span, insert: ` ${safe} ` };
}

export function insertTableRow(grid: TableGrid, at: number): Patch {
	const rows = grid.rows.slice();
	rows.splice(at, 0, { cells: grid.columns.map(() => cell("")), ruleBefore: false });
	return reprint(grid, rows);
}

export function deleteTableRow(grid: TableGrid, at: number): Patch | null {
	if (grid.rows.length <= 1) return null;
	return reprint(
		grid,
		grid.rows.filter((_, i) => i !== at)
	);
}

export function insertTableColumn(grid: TableGrid, at: number): Patch {
	const columns = grid.columns.slice();
	columns.splice(at, 0, "l");
	const rows = grid.rows.map((row) => {
		const cells = row.cells.slice();
		cells.splice(at, 0, cell(""));
		return { ...row, cells };
	});
	return reprint(grid, rows, columns);
}

export function deleteTableColumn(grid: TableGrid, at: number): Patch | null {
	if (grid.columns.length <= 1) return null;
	return reprint(
		grid,
		grid.rows.map((row) => ({ ...row, cells: row.cells.filter((_, i) => i !== at) })),
		grid.columns.filter((_, i) => i !== at)
	);
}

export function setTableColumnAlign(grid: TableGrid, at: number, align: ColumnAlign): Patch | null {
	if (!grid.columns[at] || grid.columns[at] === align) return null;
	return reprint(
		grid,
		grid.rows,
		grid.columns.map((spec, i) => (i === at ? align : spec))
	);
}

/** One edit: two patches over the same span would cancel out. Set as a group,
 *  since a half-ruled table is a hand-tuned choice this control is not for. */
export function setTableStyle(
	grid: TableGrid,
	style: { rules: boolean; borders: boolean }
): Patch | null {
	if (style.rules === grid.ruleAfter && style.borders === grid.borders) return null;
	return {
		...grid.span,
		insert: printTable({
			...grid,
			borders: style.borders,
			rows: grid.rows.map((row, i) => ({
				...row,
				ruleBefore: style.rules && (i === 0 || i === 1)
			})),
			ruleAfter: style.rules
		})
	};
}

/** Horizontal rules alone, for callers that do not care about the verticals. */
export function setTableRules(grid: TableGrid, on: boolean): Patch | null {
	return setTableStyle(grid, { rules: on, borders: grid.borders });
}

/** Whether a cell has a rule drawn along each edge, so the grid on screen shows
 *  the same lines the compiled table will. */
export function cellRules(grid: TableGrid, row: number, column: number) {
	return {
		top: row === 0 && grid.rows[0].ruleBefore,
		bottom: row === grid.rows.length - 1 ? grid.ruleAfter : grid.rows[row + 1].ruleBefore,
		left: grid.borders && column === 0,
		right: grid.borders
	};
}
