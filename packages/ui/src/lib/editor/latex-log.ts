export type LatexSeverity = 'error' | 'warning' | 'info';

export interface LatexProblem {
	severity: LatexSeverity;
	message: string;
	/** 1-based source line, when the log reports one. */
	line?: number;
}

export interface ProblemSummary {
	errors: number;
	warnings: number;
	infos: number;
	total: number;
}

const L_NUM = /^l\.(\d+)\b/;
const ON_INPUT_LINE = /on input line (\d+)/;
const AT_LINES = /at lines? (\d+)/;
const TECTONIC = /^(error|warning):\s*(.*)$/;
const WARNING_START = /^(?:LaTeX|LaTeX Font|Package \S+|Class \S+) Warning:\s*(.*)$/;
const BADBOX = /^(?:Overfull|Underfull) \\[hv]box/;

/** Extracts clickable diagnostics from a Tectonic/TeX log: `! error` blocks with
 *  `l.<n>` lines, and `LaTeX Warning … on input line <n>`. */
export function parseLatexLog(log: string | undefined, fallback?: string): LatexProblem[] {
	const out: LatexProblem[] = [];
	const seen = new Set<string>();
	const push = (p: LatexProblem) => {
		const key = `${p.severity}|${p.line ?? ''}|${p.message}`;
		if (seen.has(key)) return;
		seen.add(key);
		out.push(p);
	};

	const lines = (log ?? '').split(/\r?\n/);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Tectonic's own concise messages.
		const tect = TECTONIC.exec(line);
		if (tect) {
			push({
				severity: tect[1] === 'error' ? 'error' : 'warning',
				message: tect[2].trim() || tect[1]
			});
			continue;
		}

		// TeX error block: "! message" then a later "l.<n> ...".
		if (line.startsWith('! ')) {
			const message =
				line
					.slice(2)
					.replace(/\.$/, '')
					.replace(/^LaTeX Error:\s*/, '')
					.replace(/^Package \S+ Error:\s*/, '')
					.trim() || 'TeX error';
			let ln: number | undefined;
			for (let j = i + 1; j < Math.min(i + 16, lines.length); j++) {
				const m = L_NUM.exec(lines[j].trimStart());
				if (m) {
					ln = parseInt(m[1], 10);
					break;
				}
			}
			push({ severity: 'error', message, line: ln });
			continue;
		}

		// LaTeX / Package / Class / Font warnings, possibly wrapped over lines.
		const warn = WARNING_START.exec(line);
		if (warn) {
			let msg = warn[1].trim();
			let ln: number | undefined;
			const here = ON_INPUT_LINE.exec(line);
			if (here) ln = parseInt(here[1], 10);
			if (!ln) {
				for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
					const cont = lines[j];
					if (!cont.trim()) break;
					const more = ON_INPUT_LINE.exec(cont);
					const clean = cont.replace(/^\([^)]*\)\s*/, '').trim(); // strip "(pkg)" gutter
					if (clean) msg += ' ' + clean;
					if (more) {
						ln = parseInt(more[1], 10);
						i = j;
						break;
					}
				}
			}
			msg = msg
				.replace(/\s*on input line \d+\.?\s*$/, '')
				.replace(/\.$/, '')
				.trim();
			push({ severity: 'warning', message: msg || 'LaTeX warning', line: ln });
			continue;
		}

		// Bad boxes are common and noisy → info.
		if (BADBOX.test(line)) {
			const m = AT_LINES.exec(line);
			push({
				severity: 'info',
				message: line.trim(),
				line: m ? parseInt(m[1], 10) : undefined
			});
			continue;
		}
	}

	if (out.length === 0 && fallback?.trim()) {
		push({ severity: 'error', message: fallback.trim() });
	}

	return out.slice(0, 300);
}

export function summarizeProblems(problems: LatexProblem[]): ProblemSummary {
	let errors = 0;
	let warnings = 0;
	let infos = 0;
	for (const p of problems) {
		if (p.severity === 'error') errors++;
		else if (p.severity === 'warning') warnings++;
		else infos++;
	}
	return { errors, warnings, infos, total: problems.length };
}
