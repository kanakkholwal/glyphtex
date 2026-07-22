// SyncTeX stores TeX scaled points; the PDF grid is big points. Verified against real
// Tectonic output: a record's `v - height` lands exactly on the 1-inch page margin.
const TEX_PT_PER_SP = 1 / 65536;
const BP_PER_TEX_PT = 72 / 72.27;

export interface SyncTexRecord {
	tag: number;
	line: number;
	/** PDF big-points from the left edge. */
	h: number;
	/** PDF big-points from the top edge (box reference / baseline). */
	v: number;
	width: number;
	height: number;
	depth: number;
}

export interface SyncTexHit {
	tag: number;
	line: number;
}

/** A located region in the PDF (big-points; `v` from the top), for forward sync. */
export interface SyncTexLocation {
	page: number;
	h: number;
	v: number;
	width: number;
	height: number;
	depth: number;
}

export class SyncTexMap {
	#pages = new Map<number, SyncTexRecord[]>();
	#flat: Array<SyncTexRecord & { page: number }> = [];
	#mainTag = 0;

	add(page: number, rec: SyncTexRecord): void {
		const list = this.#pages.get(page);
		if (list) list.push(rec);
		else this.#pages.set(page, [rec]);
		this.#flat.push({ ...rec, page });
		// The main input is the lowest tag that carries source lines (usually 1).
		if (rec.line && (this.#mainTag === 0 || rec.tag < this.#mainTag)) this.#mainTag = rec.tag;
	}

	get pageCount(): number {
		return this.#pages.size;
	}

	/**
	 * Forward search (source → PDF): given a 1-based source line, return the PDF
	 * region to reveal. Prefers an exact line match (topmost on the earliest
	 * page), else the nearest line.
	 */
	forward(line: number, tag?: number): SyncTexLocation | null {
		if (!this.#flat.length) return null;
		const t = tag || this.#mainTag || 1;

		let chosen: (SyncTexRecord & { page: number }) | null = null;
		let exact: (SyncTexRecord & { page: number }) | null = null;
		let bestDelta = Infinity;

		for (const r of this.#flat) {
			if (r.tag !== t || !r.line) continue;
			if (r.line === line) {
				if (!exact || r.page < exact.page || (r.page === exact.page && r.v < exact.v)) exact = r;
			}
			const d = Math.abs(r.line - line);
			if (d < bestDelta || (d === bestDelta && chosen && r.page < chosen.page)) {
				bestDelta = d;
				chosen = r;
			}
		}

		const hit = exact ?? chosen;
		if (!hit) return null;
		return {
			page: hit.page,
			h: hit.h,
			v: hit.v,
			width: hit.width,
			height: hit.height,
			depth: hit.depth
		};
	}

	/**
	 * Find the source line nearest a PDF click. `x`/`y` are PDF big-points with
	 * `y` measured from the top of the page (page is 1-based).
	 *
	 * Vertical proximity dominates (you click a line, not a column); horizontal
	 * distance breaks ties, and when a click lands inside several nested boxes we
	 * prefer the smallest (innermost ⇒ most specific line).
	 */
	locate(page: number, x: number, y: number): SyncTexHit | null {
		const nodes = this.#pages.get(page);
		if (!nodes?.length) return null;

		let best: SyncTexRecord | null = null;
		let bestScore = Infinity;

		for (const n of nodes) {
			if (!n.line) continue;
			const top = n.v - n.height;
			const bottom = n.v + n.depth;
			const left = n.h;
			const right = n.h + n.width;

			const insideV = y >= top - 1 && y <= bottom + 1;
			const insideH = x >= left - 1 && x <= right + 1;

			const dv = insideV ? 0 : Math.min(Math.abs(y - top), Math.abs(y - bottom), Math.abs(y - n.v));
			const dh = insideH ? 0 : Math.min(Math.abs(x - left), Math.abs(x - right), Math.abs(x - n.h));
			const area = Math.abs(n.width) + Math.abs(n.height) + Math.abs(n.depth);

			// Vertical proximity weighted heavily; small in-box bonus for innermost.
			const score = dv * 1000 + dh + (insideV && insideH ? area * 0.001 : 0);
			if (score < bestScore) {
				bestScore = score;
				best = n;
			}
		}

		return best ? { tag: best.tag, line: best.line } : null;
	}
}

function parseRecord(
	payload: string
): { tag: number; line: number; h: number; v: number; w: number; ht: number; dp: number } | null {
	// payload: "tag,line:h,v" with an optional ":width,height,depth".
	const parts = payload.split(':');
	if (parts.length < 2) return null;

	const tl = parts[0].split(',');
	if (tl.length < 2) return null;
	const tag = parseInt(tl[0], 10);
	const line = parseInt(tl[1], 10);

	const hv = parts[1].split(',');
	if (hv.length < 2) return null;
	const h = parseInt(hv[0], 10);
	const v = parseInt(hv[1], 10);

	if (![tag, line, h, v].every(Number.isFinite)) return null;

	let w = 0,
		ht = 0,
		dp = 0;
	if (parts[2]) {
		const whd = parts[2].split(',');
		w = parseInt(whd[0], 10) || 0;
		ht = parseInt(whd[1], 10) || 0;
		dp = parseInt(whd[2], 10) || 0;
	}
	return { tag, line, h, v, w, ht, dp };
}

/** Parse decompressed SyncTeX text into a reverse-search map. */
export function parseSyncTex(text: string): SyncTexMap {
	const lines = text.split(/\r?\n/);

	let unit = 1;
	let mag = 1000;
	let xoff = 0;
	let yoff = 0;

	let i = 0;
	for (; i < lines.length; i++) {
		const ln = lines[i];
		if (ln.startsWith('Unit:')) unit = parseFloat(ln.slice(5)) || 1;
		else if (ln.startsWith('Magnification:')) mag = parseFloat(ln.slice(14)) || 1000;
		else if (ln.startsWith('X Offset:')) xoff = parseFloat(ln.slice(9)) || 0;
		else if (ln.startsWith('Y Offset:')) yoff = parseFloat(ln.slice(9)) || 0;
		else if (ln === 'Content:') {
			i++;
			break;
		}
	}

	const factor = unit * TEX_PT_PER_SP * BP_PER_TEX_PT * (mag / 1000);
	const map = new SyncTexMap();
	let page = 0;

	for (; i < lines.length; i++) {
		const ln = lines[i];
		if (!ln) continue;
		const c = ln[0];

		if (c === '{' || c === '}') {
			if (c === '{') {
				const n = parseInt(ln.slice(1), 10);
				if (Number.isFinite(n)) page = Math.abs(n);
			}
			continue;
		}
		if (c === ')' || c === ']') continue; // box close — no payload

		// Any record line: "<type>tag,line:h,v[:w,h,d]". Non-records (Input:, !238,
		// <, >) fail the strict parse and are skipped.
		const rec = parseRecord(ln.slice(1));
		if (!rec || !page) continue;

		map.add(page, {
			tag: rec.tag,
			line: rec.line,
			h: (rec.h + xoff) * factor,
			v: (rec.v + yoff) * factor,
			width: rec.w * factor,
			height: rec.ht * factor,
			depth: rec.dp * factor
		});
	}

	return map;
}
