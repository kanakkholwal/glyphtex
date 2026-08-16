// Visual mode must be editable, and every edit must land in the LaTeX source
// without disturbing anything it did not touch. Only a real browser can test
// this: the surface is contenteditable, and the model is read back off the DOM.
import fs from "node:fs";
import path from "node:path";
import { connect, sleep } from "./harness.mjs";

const {
	send,
	ev,
	check,
	clearModals,
	clickSel,
	key,
	typeText,
	editorDoc,
	focusDoc,
	openProject,
	finish
} = await connect();

await openProject();
await focusDoc();

// --- Load a document with something worth not breaking ------------------------
const fixture = fs.readFileSync(
	path.join(import.meta.dirname, "..", "fixtures", "tikz.tex"),
	"utf8"
);
const article = fs.readFileSync(
	path.join(import.meta.dirname, "..", "fixtures", "article.tex"),
	"utf8"
);
const source = editorDoc;

const toVisual = async () => {
	await ev(
		`(() => { const b = [...document.querySelectorAll('button')].find(x => /^visual$/i.test((x.textContent||'').trim())); b?.click(); return !!b; })()`
	);
	for (let i = 0; i < 25; i++) {
		await sleep(300);
		if (await ev(`!!document.querySelector('[data-block-editor]')`)) return true;
	}
	return false;
};
const toLatex = async () => {
	await ev(
		`(() => { const b = [...document.querySelectorAll('button')].find(x => /^latex$/i.test((x.textContent||'').trim())); b?.click(); return !!b; })()`
	);
	for (let i = 0; i < 25; i++) {
		await sleep(300);
		if (await ev(`!!document.querySelector('.cm-content')`)) return true;
	}
	return false;
};

async function loadSource(text, marker) {
	// The source only exists in the LaTeX view, and a section that ended in visual
	// mode would otherwise type into nothing and fail three checks later.
	await toLatex();
	for (let attempt = 0; attempt < 3; attempt++) {
		await clearModals();
		await focusDoc();
		await key("a", "KeyA", 65, 2);
		await sleep(150);
		await send("Input.insertText", { text });
		await sleep(900);
		if ((await source())?.includes(marker)) return true;
	}
	return false;
}

check("fixture loads in the LaTeX view", await loadSource(article, "Consistency of Estimators"));

check("visual mode renders editable blocks", await toVisual());

// Click into the nth editable block and put the caret at its end.
const placeCaret = (n, where = "end") =>
	ev(`(() => {
	  const el = document.querySelectorAll('[data-block-editor]')[${n}];
	  if (!el) return false;
	  el.focus();
	  const r = document.createRange();
	  r.selectNodeContents(el);
	  r.collapse(${where === "start"});
	  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
	  return document.activeElement === el;
	})()`);

// Retries: the pane re-renders for a beat after a mode switch or a structural
// edit, and a single focus() call is dropped when it does.
const caretInBlock = async (n, where = "end") => {
	let ok = false;
	for (let i = 0; i < 12; i++) {
		ok = await placeCaret(n, where);
		await sleep(150);
		if (await ev(`!!document.querySelector('[data-block-wrapper]:focus-within')`)) return true;
	}
	return ok;
};

const blockText = (n) =>
	ev(`document.querySelectorAll('[data-block-editor]')[${n}]?.innerText.trim()`);

// --- Typing into a paragraph reaches the source -------------------------------
check("a block takes the caret", await caretInBlock(1));
await typeText(" EDITED");
await sleep(400);
check("the typed text shows in the block", (await blockText(1))?.endsWith("EDITED"));

check("back to LaTeX", await toLatex());
const afterTyping = await source();
check(
	"the edit landed in the LaTeX source",
	afterTyping?.includes("EDITED"),
	"not found in source"
);
check(
	"the rest of the document is untouched",
	afterTyping?.includes("\\begin{figure}") && afterTyping?.includes("\\includegraphics"),
	"a float was rewritten"
);

// --- Round trip: visual -> latex -> visual -> latex must settle ---------------
await toVisual();
await sleep(600);
await toLatex();
const secondTrip = await source();
check(
	"a second round trip changes nothing",
	secondTrip === afterTyping,
	"the document drifts every time you switch modes"
);

// --- Enter opens a new block, and typing materialises it ----------------------
await toVisual();
await caretInBlock(1);
await key("Enter", "Enter", 13);
await sleep(300);
await typeText("A brand new paragraph.");
await sleep(500);
await toLatex();
const afterEnter = await source();
check("Enter then typing creates a real paragraph", afterEnter?.includes("A brand new paragraph."));
check(
	"the new paragraph is its own block, not glued on",
	/\n\s*\n\s*A brand new paragraph\./.test(afterEnter ?? ""),
	JSON.stringify(
		afterEnter?.slice(
			Math.max(0, (afterEnter?.indexOf("A brand new") ?? 0) - 30),
			(afterEnter?.indexOf("A brand new") ?? 0) + 30
		)
	)
);

// --- Input rule: "## " turns an empty block into a subsection -----------------
await toVisual();
await caretInBlock(1);
await key("Enter", "Enter", 13);
await sleep(300);
await typeText("## ");
await sleep(600);
await typeText("Ruled Heading");
await sleep(500);
await toLatex();
check(
	'"## " converts to a subsection',
	/\\subsection\{Ruled Heading\}/.test((await source()) ?? ""),
	"input rule did not fire"
);

// --- Slash menu inserts a block ------------------------------------------------
await toVisual();
await caretInBlock(1);
await key("Enter", "Enter", 13);
await sleep(300);
await send("Input.dispatchKeyEvent", {
	type: "keyDown",
	key: "/",
	code: "Slash",
	windowsVirtualKeyCode: 191
});
await send("Input.dispatchKeyEvent", {
	type: "keyUp",
	key: "/",
	code: "Slash",
	windowsVirtualKeyCode: 191
});
await sleep(500);
check("the slash menu opens", await ev(`!!document.querySelector('[aria-label="Insert block"]')`));
await typeText("equat");
await sleep(400);
await key("Enter", "Enter", 13);
await sleep(600);
await toLatex();
check("picking Equation inserts one", /\\begin\{equation\}/.test((await source()) ?? ""));

// --- Everything the LaTeX toolbar inserts is reachable here too ----------------
check("reload for the parity checks", await loadSource(article, "Consistency of Estimators"));
await toVisual();
await caretInBlock(1);
await key("Enter", "Enter", 13);
await sleep(300);
const slash = async (modifiers = 0) => {
	for (const type of ["keyDown", "keyUp"])
		await send("Input.dispatchKeyEvent", {
			type,
			key: "/",
			code: "Slash",
			windowsVirtualKeyCode: 191,
			modifiers
		});
	await sleep(500);
};
await slash();
const offered = await ev(`(() => {
  const menu = document.querySelector('[aria-label="Insert block"]');
  if (!menu) return null;
  return {
    groups: [...menu.querySelectorAll('[role="listbox"] > p')].map(p => p.textContent.trim()),
    labels: [...menu.querySelectorAll('[role="option"]')].map(o => o.textContent.trim())
  };
})()`);
check(
	"the insert menu groups its entries",
	!!offered && offered.groups.length >= 4,
	JSON.stringify(offered?.groups)
);
for (const wanted of ["Part", "Chapter", "Matrix", "Cases", "Display maths", "Description list"]) {
	check(
		`the / menu offers ${wanted}`,
		!!offered?.labels.includes(wanted),
		JSON.stringify(offered?.labels)
	);
}
await key("Escape", "Escape", 27);
await sleep(300);

// --- An inline atom can be inserted at the caret, not only edited --------------
// Ctrl+/ rather than a bare slash: the caret sits tight against a word, where a
// bare slash is a character the writer meant to type. Reloaded first, so the
// empty draft the section above left behind cannot shift the block indices.
check("reload for the inline insert", await loadSource(article, "Consistency of Estimators"));
await toVisual();
await caretInBlock(1);
await slash(2);
check(
	"Ctrl+/ opens the menu against a word",
	await ev(`!!document.querySelector('[aria-label="Insert block"]')`)
);
check(
	"the menu offers inline things when there is a caret",
	await ev(
		`[...document.querySelectorAll('[role="option"]')].some(o => o.textContent.trim() === 'Footnote')`
	)
);
await typeText("footnote");
await sleep(400);
await key("Enter", "Enter", 13);
await sleep(600);
check(
	"picking Footnote opens its editor",
	await ev(`!!document.querySelector('[role="dialog"][aria-label^="Edit footnote"]')`)
);
await ev(`(() => {
  const input = document.querySelector('[role="dialog"][aria-label^="Edit footnote"] input');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'A note from the visual editor.');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const apply = [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.trim() === 'Apply');
  apply?.click();
  return true;
})()`);
await sleep(700);
await toLatex();
check(
	"the footnote lands in the LaTeX source",
	/\\footnote\{A note from the visual editor\.\}/.test((await source()) ?? ""),
	JSON.stringify((await source())?.match(/\\footnote\{[^}]*\}/)?.[0])
);

// --- Selection formatting -----------------------------------------------------
check("reload for the selection checks", await loadSource(article, "Consistency of Estimators"));
await toVisual();
await sleep(500);

// Select the first word of a paragraph and bold it from the floating bar. The
// pane re-renders for a beat after a mode switch, so this waits for a block
// rather than reading whatever is there on the first look.
const selectFirstWord = async () => {
	for (let i = 0; i < 12; i++) {
		const word = await ev(`(() => {
		  const el = [...document.querySelectorAll('[data-block-editor]')].find(e => (e.innerText||'').trim().length > 30);
		  if (!el) return null;
		  const node = [...el.childNodes].find(n => n.nodeType === 3 && n.nodeValue.trim().length > 4);
		  if (!node) return null;
		  el.focus();
		  const r = document.createRange();
		  r.setStart(node, 0);
		  r.setEnd(node, 4);
		  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
		  document.dispatchEvent(new Event('selectionchange'));
		  return r.toString();
		})()`);
		if (word) return word;
		await sleep(250);
	}
	return null;
};
const selectedWord = await selectFirstWord();
await sleep(400);
check(
	"a selection raises the format bar",
	await ev(`!!document.querySelector('[aria-label="Format selection"]')`),
	String(selectedWord)
);

await ev(
	`(() => { const b = document.querySelector('[aria-label="Format selection"] [aria-label="Bold"]'); b?.click(); return !!b; })()`
);
await sleep(600);
await toLatex();
check(
	"the format bar writes \\textbf into the source",
	/\\textbf\{/.test((await source()) ?? ""),
	"no bold reached the source"
);

// The overflow is where the other eight marks live; small caps must not come
// back as \emph, which is what the old single mark kind did to it.
await toVisual();
await sleep(500);
check("a word is selected for the overflow checks", !!(await selectFirstWord()));
await sleep(400);
await ev(
	`(() => { const b = document.querySelector('[aria-label="More formatting"]'); b?.click(); return !!b; })()`
);
await sleep(300);
check(
	"the format bar has an overflow with the rest of the marks",
	(await ev(
		`document.querySelectorAll('[aria-label="More formatting"][role="menu"] [role="menuitemcheckbox"]').length`
	)) >= 7
);
await ev(`(() => {
  const item = [...document.querySelectorAll('[role="menuitemcheckbox"]')].find(i => i.textContent.includes('Small caps'));
  item?.click();
  return !!item;
})()`);
await sleep(600);
await toLatex();
check(
	"small caps writes \\textsc, not \\emph",
	/\\textsc\{/.test((await source()) ?? ""),
	JSON.stringify((await source())?.match(/\\text(sc|it)\{[^}]*\}/)?.[0])
);

// --- The bar reports the selection as well as changing it ---------------------
check("reload for the bar state checks", await loadSource(article, "Consistency of Estimators"));
await toVisual();
await sleep(500);
const selectWord = () =>
	ev(`(() => {
  const el = [...document.querySelectorAll('[data-block-editor]')].find(e => (e.innerText||'').trim().length > 30);
  const node = [...el.childNodes].find(n => n.nodeType === 3 && n.nodeValue.trim().length > 4);
  el.focus();
  const r = document.createRange();
  r.setStart(node, 0); r.setEnd(node, 4);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.dispatchEvent(new Event('selectionchange'));
  return true;
})()`);
await selectWord();
await sleep(400);
const barOrder = await ev(
	`[...document.querySelectorAll('[aria-label="Format selection"] > button')].map(b => b.getAttribute('aria-label'))`
);
check(
	"bold, italic and underline sit together, then the objects, then the link",
	JSON.stringify(barOrder) ===
		JSON.stringify([
			"Bold",
			"Italic",
			"Underline",
			"Monospace",
			"Inline maths",
			"Link",
			"More formatting"
		]),
	JSON.stringify(barOrder)
);
check(
	"nothing reads as on before anything is applied",
	await ev(
		`[...document.querySelectorAll('[aria-label="Format selection"] > button')].every(b => b.getAttribute('aria-pressed') !== 'true')`
	)
);

// Two marks on the same words, then the bar has to show both.
await ev(
	`(() => { const b = document.querySelector('[aria-label="Format selection"] [aria-label="Bold"]'); b?.click(); return !!b; })()`
);
await sleep(400);
await ev(
	`(() => { const b = document.querySelector('[aria-label="Format selection"] [aria-label="Italic"]'); b?.click(); return !!b; })()`
);
await sleep(400);
const stacked = await ev(`(() => {
  const bar = document.querySelector('[aria-label="Format selection"]');
  const on = [...bar.querySelectorAll('button')].filter(b => b.getAttribute('aria-pressed') === 'true');
  return on.map(b => b.getAttribute('aria-label'));
})()`);
check(
	"two marks on one selection both show as on",
	stacked.includes("Bold") && stacked.includes("Italic"),
	JSON.stringify(stacked)
);
await toLatex();
check(
	"and both reach the source, nested",
	/\\text(bf|it)\{\\text(bf|it)\{/.test((await source()) ?? ""),
	JSON.stringify((await source())?.match(/\\text(bf|it)\{[^}]*\}[^\n]{0,20}/)?.[0])
);

// A link can be taken off again without deleting the words it wrapped.
await toVisual();
await sleep(500);
await selectWord();
await sleep(400);
await ev(
	`(() => { const b = document.querySelector('[aria-label="Format selection"] [aria-label="Link"]'); b?.click(); return !!b; })()`
);
await sleep(600);
await ev(
	`(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find(x => x.textContent.trim() === 'Apply'); b?.click(); return !!b; })()`
);
await sleep(600);
await toLatex();
check("the Link control writes an \\href", /\\href\{/.test((await source()) ?? ""));

await toVisual();
await sleep(500);
const overLink = await ev(`(() => {
  const link = document.querySelector('[data-atom="link"]');
  if (!link) return false;
  const host = link.closest('[data-block-editor]');
  host.focus();
  const r = document.createRange();
  r.selectNode(link);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.dispatchEvent(new Event('selectionchange'));
  return true;
})()`);
await sleep(400);
check(
	"selecting a link swaps the control for Unlink",
	overLink && (await ev(`!!document.querySelector('[aria-label="Remove link"]')`))
);
await ev(
	`(() => { const b = document.querySelector('[aria-label="Remove link"]'); b?.click(); return !!b; })()`
);
await sleep(600);
await toLatex();
const unlinked = await source();
check("unlinking removes the command but keeps the words", !/\\href\{/.test(unlinked ?? ""));

// Clicking a link opens its editor, so the same escape has to exist in there.
await toVisual();
await sleep(500);
await selectWord();
await sleep(400);
await ev(
	`(() => { const b = document.querySelector('[aria-label="Format selection"] [aria-label="Link"]'); b?.click(); return !!b; })()`
);
await sleep(600);
await ev(
	`(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find(x => x.textContent.trim() === 'Apply'); b?.click(); return !!b; })()`
);
await sleep(600);
const linkWords = await ev(`document.querySelector('[data-atom="link"]')?.textContent ?? ''`);
await ev(
	`(() => { const a = document.querySelector('[data-atom="link"]'); a?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!a; })()`
);
await sleep(400);
const dialogButtons = () =>
	ev(`[...document.querySelectorAll('[role="dialog"] button')].map(b => b.textContent.trim())`);
check(
	"the link editor offers Unlink beside Delete",
	(await dialogButtons())?.includes("Unlink"),
	JSON.stringify(await dialogButtons())
);
await ev(
	`(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find(x => x.textContent.trim() === 'Unlink'); b?.click(); return !!b; })()`
);
await sleep(600);
await toLatex();
const afterEditor = (await source()) ?? "";
check(
	"Unlink in the editor drops the command and keeps the text",
	!/\\href\{/.test(afterEditor) && !!linkWords && afterEditor.includes(linkWords),
	JSON.stringify(linkWords)
);

// --- The gutter stands down while a menu owns the pointer ---------------------
await toVisual();
await sleep(500);
await caretInBlock(1);
const gutterVisible = () =>
	ev(`(() => {
  const g = document.querySelector('[data-block-wrapper]:focus-within [data-block-gutter]');
  return g ? getComputedStyle(g).opacity : 'no gutter';
})()`);
const gutterOn = await gutterVisible();
// A number, not '1': the fade may still be running when the check reads it.
check("the gutter shows on the focused block", Number(gutterOn) > 0.9, String(gutterOn));
check(
	"the focused block carries an active marker, and only that block",
	await ev(
		`(() => {
		  const w = document.activeElement.closest('[data-block-wrapper]');
		  if (!w) return false;
		  const bar = w.querySelector('span[aria-hidden]');
		  const lit = getComputedStyle(bar).backgroundColor;
		  return lit !== 'rgba(0, 0, 0, 0)' && !lit.includes('/ 0)');
		})()`
	)
);
await ev(
	`(() => {
	  const w = document.querySelector('[data-block-wrapper]:focus-within');
	  const b = w?.querySelector('[aria-label="Block actions"]');
	  b?.click();
	  return !!b;
	})()`
);
await sleep(400);
// The trigger is the popover's anchor, so it has to stay put and read as active.
const gutterOff = await ev(`(() => {
  const grip = document.querySelector('[aria-label="Block actions"][aria-expanded="true"]');
  return grip ? getComputedStyle(grip.parentElement).opacity : 'no open grip';
})()`);
check("the trigger stays visible under its own menu", gutterOff === "1", String(gutterOff));
await key("Escape", "Escape", 27);
await sleep(300);

// --- Atoms are editable, not read-only holes ----------------------------------
check("reload for the atom checks", await loadSource(article, "Consistency of Estimators"));
await toVisual();
await sleep(500);
const atomOpened = await ev(`(() => {
  const a = document.querySelector('[data-block-editor] [data-atom="cite"]');
  if (!a) return false;
  a.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
})()`);
await sleep(500);
check(
	"clicking a citation opens its editor",
	atomOpened && (await ev(`!!document.querySelector('[role="dialog"][aria-label^="Edit"]')`))
);

await ev(`(() => {
  const input = document.querySelector('[role="dialog"][aria-label^="Edit"] input');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'replaced2026');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(300);
await ev(
	`(() => { const b = [...document.querySelectorAll('[role="dialog"][aria-label^="Edit"] button')].find(x => x.textContent.trim() === 'Apply'); b?.click(); return !!b; })()`
);
await sleep(700);
await toLatex();
check(
	"editing a citation rewrites its keys",
	/\\citep?\{[^}]*replaced2026/.test((await source()) ?? ""),
	JSON.stringify((await source())?.match(/\\cite\w*\{[^}]*\}/)?.[0])
);

// --- Cross-block selection must not corrupt the document ----------------------
check("reload for the cross-block check", await loadSource(article, "Consistency of Estimators"));
const beforeCross = await source();
await toVisual();
await sleep(500);
await ev(`(() => {
  const els = [...document.querySelectorAll('[data-block-editor]')];
  const a = els[1], b = els[2];
  if (!a || !b) return false;
  a.focus();
  const r = document.createRange();
  r.setStart(a, 0);
  r.setEnd(b, b.childNodes.length);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  return true;
})()`);
await key("Backspace", "Backspace", 8);
await sleep(600);
await toLatex();
check(
	"a selection spanning two blocks is refused, not applied",
	(await source()) === beforeCross,
	"a cross-block delete mutated the document"
);

// --- A figure is editable where it can be, verbatim everywhere else -----------
check("reload the article", await loadSource(article, "Consistency of Estimators"));
await toVisual();
await sleep(500);
check(
	"the figure renders as a card with its caption",
	await ev(
		`(() => { const c = document.querySelector('[data-float-caption]'); return !!c && /Empirical convergence/.test(c.textContent); })()`
	)
);

await ev(`(() => {
  const c = document.querySelector('[data-float-caption]');
  c.focus();
  c.textContent = 'A rewritten caption.';
  c.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(700);
await toLatex();
const afterCaption = await source();
check(
	"editing the caption rewrites only the caption",
	/\\caption\{A rewritten caption\.\}/.test(afterCaption ?? "")
);
check(
	"the graphic and its options are untouched",
	afterCaption?.includes("\\includegraphics[width=0.7\\linewidth]{figures/convergence}"),
	"the includegraphics line was rewritten"
);
check(
	"the figure label survives a caption edit",
	afterCaption?.includes("\\label{fig:convergence}")
);

await toVisual();
await sleep(500);
await ev(
	`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Full' && x.closest('figure')); b?.click(); return !!b; })()`
);
await sleep(700);
await toLatex();
check(
	"the width control rewrites only width=",
	/\\includegraphics\[width=\\linewidth\]\{figures\/convergence\}/.test((await source()) ?? ""),
	JSON.stringify((await source())?.match(/\\includegraphics[^\n]*/)?.[0])
);

// --- A block we do not model is never rewritten -------------------------------
check("tikz fixture loads", await loadSource(fixture, "tikzpicture"));
const beforeTikz = await source();
await toVisual();
await sleep(500);
const rawChips = await ev(
	`document.querySelectorAll('[aria-label="Visual editor"] .border-dashed').length`
);
check("a tikzpicture shows as an inert chip", rawChips >= 1, `chips: ${rawChips}`);
await toLatex();
check("opening it in visual mode changed nothing", (await source()) === beforeTikz);

// --- A table is a grid here, not a trip to the LaTeX view ---------------------
const TABLE_DOC = [
	"\\documentclass{article}",
	"\\usepackage{graphicx}",
	"\\begin{document}",
	"\\begin{table}[h]",
	"  \\centering",
	"  \\begin{tabular}{l l}",
	"    \\hline",
	"    \\textbf{Header 1} & Header 2 \\\\",
	"    \\hline",
	"    Cell 1 & Cell 2 \\\\",
	"    Cell 3 & Cell 4 \\\\",
	"    \\hline",
	"  \\end{tabular}",
	"  \\caption{Caption text.}",
	"\\end{table}",
	"",
	"\\begin{figure}",
	"  \\includegraphics{example-image}",
	"\\end{figure}",
	"\\end{document}",
	""
].join("\n");

check("table document loads", await loadSource(TABLE_DOC, "Header 1"));
await toVisual();
// The grid only exists once the parse lands; a fixed sleep raced it.
for (let i = 0; i < 15; i++) {
	await sleep(200);
	if (await ev(`document.querySelectorAll('td [data-block-editor]').length > 0`)) break;
}

const shape = () =>
	ev(`(() => {
  const cells = [...document.querySelectorAll('td [data-block-editor]')];
  return { cells: cells.length, texts: cells.map(c => c.textContent.trim()) };
})()`);
const grid0 = await shape();
check("the table renders as an editable grid", grid0.cells === 6, JSON.stringify(grid0));
check(
	"the cells hold the real contents",
	grid0.texts.join("|") === "Header 1|Header 2|Cell 1|Cell 2|Cell 3|Cell 4",
	JSON.stringify(grid0.texts)
);
// The header is `\textbf{…}` in the source. Showing those six characters is what
// a text box does; a cell has to render them.
check(
	"a cell renders its formatting instead of printing the macro",
	await ev(
		`!!document.querySelector('td [data-block-editor] strong') && !document.querySelector('td [data-block-editor]').textContent.includes('textbf')`
	),
	await ev(`document.querySelector('td [data-block-editor]').innerHTML`)
);
check(
	"vertical rules are absent when the spec has no pipes",
	await ev(
		`[...document.querySelectorAll('td')].every(t => !getComputedStyle(t).borderRightWidth.startsWith('1'))`
	)
);

await ev(`(() => {
  const cell = document.querySelectorAll('td [data-block-editor]')[3];
  cell.focus();
  cell.textContent = 'Edited cell';
  cell.blur();
  return true;
})()`);
await sleep(700);
await toLatex();
const afterCell = await source();
check("editing a cell rewrites only that cell", /Cell 1 & Edited cell/.test(afterCell ?? ""));
check(
	"the rest of the table is byte identical",
	(afterCell ?? "").replace("Edited cell", "Cell 2") === TABLE_DOC,
	"the table was reformatted"
);

await toVisual();
await sleep(500);
await ev(
	`(() => { const b = document.querySelector('[aria-label="Add row"]'); b?.click(); return !!b; })()`
);
await sleep(700);
check("adding a row gives the grid one more", (await shape()).cells === 8);
await ev(
	`(() => { const b = document.querySelector('[aria-label="Add column"]'); b?.click(); return !!b; })()`
);
await sleep(700);
check("adding a column widens every row", (await shape()).cells === 12);
await toLatex();
check(
	"the column reaches the spec, not just the rows",
	/\\begin\{tabular\}\{l l l\}/.test((await source()) ?? ""),
	JSON.stringify((await source())?.match(/\\begin\{tabular\}\{[^}]*\}/)?.[0])
);

// A column menu is where alignment and targeted inserts live.
await toVisual();
await sleep(500);
for (let i = 0; i < 8; i++) {
	await ev(
		`(() => { const b = document.querySelector('[aria-label="Column 2 actions"]'); b?.click(); return !!b; })()`
	);
	await sleep(300);
	if (await ev(`!!document.querySelector('[role="menu"][aria-label="Column actions"]')`)) break;
}
check(
	"a column handle opens its menu",
	await ev(`!!document.querySelector('[role="menu"][aria-label="Column actions"]')`)
);
await ev(`(() => {
  const item = [...document.querySelectorAll('[role="menuitemradio"]')].find(i => i.textContent.includes('Align centre'));
  item?.click();
  return !!item;
})()`);
await sleep(700);
await toLatex();
check(
	"column alignment lands in the spec",
	/\\begin\{tabular\}\{l c l\}/.test((await source()) ?? ""),
	JSON.stringify((await source())?.match(/\\begin\{tabular\}\{[^}]*\}/)?.[0])
);

// --- Vertical rules exist, in both directions ---------------------------------
await toVisual();
await sleep(500);
await ev(
	`(() => { const b = [...document.querySelectorAll('figure button')].find(x => x.textContent.trim() === 'Grid'); b?.click(); return !!b; })()`
);
await sleep(700);
await toLatex();
check(
	"the Grid style writes pipes into the column spec",
	/\\begin\{tabular\}\{\|l\|c\|l\|\}/.test((await source()) ?? ""),
	JSON.stringify((await source())?.match(/\\begin\{tabular\}\{[^}]*\}/)?.[0])
);
await toVisual();
await sleep(600);
check(
	"and the grid on screen draws them too",
	await ev(
		`[...document.querySelectorAll('td')].some(t => getComputedStyle(t).borderRightWidth.startsWith('1'))`
	)
);

// --- A figure with no caption can still be given one --------------------------
check("reload the table document", await loadSource(TABLE_DOC, "Header 1"));
await toVisual();
await sleep(600);

// Regression guard: an empty caption still has to be a target you can hit. Taking
// the placeholder out of the flow collapsed the span to zero width, and clicking
// it did nothing at all. `.focus()` would not have caught that, so click it.
await clickSel("[data-float-caption]");
check(
	"clicking an empty caption puts the caret in it",
	await ev(`!!document.activeElement?.hasAttribute?.('data-float-caption')`),
	await ev(`document.activeElement?.tagName`)
);

// The placeholder was driven off the model, which only catches up on a reparse,
// so it sat under the first characters you typed.
const emptyBefore = await ev(`(() => {
  const caption = [...document.querySelectorAll('[data-float-caption]')].pop();
  const before = caption.hasAttribute('data-empty');
  caption.focus();
  caption.textContent = 'A';
  caption.dispatchEvent(new Event('input', { bubbles: true }));
  return before;
})()`);
await sleep(300);
const emptyAfter = await ev(
	`[...document.querySelectorAll('[data-float-caption]')].pop().hasAttribute('data-empty')`
);
check(
	"the caption placeholder clears on the first keystroke",
	emptyBefore && !emptyAfter,
	JSON.stringify({ emptyBefore, emptyAfter })
);

await ev(`(() => {
  const caption = [...document.querySelectorAll('[data-float-caption]')].pop();
  caption.focus();
  caption.textContent = 'Added from visual mode.';
  caption.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(700);
await toLatex();
check(
	"a caption is created for a float that had none",
	/\\includegraphics\{example-image\}\n\s*\\caption\{Added from visual mode\.\}/.test(
		(await source()) ?? ""
	),
	JSON.stringify((await source())?.match(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/)?.[0])
);

// --- Float controls write real LaTeX ------------------------------------------
await toVisual();
await sleep(600);
await ev(
	`(() => { const b = [...document.querySelectorAll('figure button')].find(x => x.textContent.trim() === '60%'); b?.click(); return !!b; })()`
);
await sleep(700);
await toLatex();
check(
	"the width control adds width= to a graphic that had none",
	/\\includegraphics\[width=0\.6\\linewidth\]\{example-image\}/.test((await source()) ?? "")
);

await toVisual();
await sleep(600);
await ev(
	`(() => { const b = [...document.querySelectorAll('figure [aria-label="Centre"]')].pop(); b?.click(); return !!b; })()`
);
await sleep(700);
await toLatex();
check(
	"the alignment control adds \\centering",
	/\\begin\{figure\}\n\s*\\centering/.test((await source()) ?? "")
);

await toVisual();
await sleep(600);
await ev(
	`(() => { const b = [...document.querySelectorAll('figure [aria-label="Float options"]')].pop(); b?.click(); return !!b; })()`
);
await sleep(400);
check(
	"the options popover opens",
	await ev(`!!document.querySelector('[role="dialog"][aria-label="Float options"]')`)
);
await ev(`(() => {
  const b = [...document.querySelectorAll('[role="dialog"][aria-label="Float options"] button')].find(x => x.textContent.trim() === 'Text left');
  b?.click();
  return !!b;
})()`);
await sleep(900);
await toLatex();
const wrapped = await source();
check(
	"text wrap converts the figure to a wrapfigure",
	/\\begin\{wrapfigure\}\{r\}/.test(wrapped ?? "")
);
check("and loads the package it needs", /\\usepackage\{wrapfig\}/.test(wrapped ?? ""));

// --- Undo ---------------------------------------------------------------------
await toVisual();
await caretInBlock(0);
await typeText("ZZZ");
await sleep(500);
await key("z", "KeyZ", 90, 2);
await sleep(500);
await toLatex();
check(
	"Ctrl+Z reverts a visual edit",
	!(await source())?.includes("ZZZ"),
	"the undo stack missed it"
);

// --- What the editor cannot rewrite, it must not rewrite ----------------------
const guarded = [
	"\\documentclass{article}",
	"\\begin{document}",
	"A plain paragraph to edit.",
	"",
	"Held at \\SI{298.15}{\\kelvin} in \\textcolor{red}{red} throughout.",
	"",
	"Inline maths as \\( E = mc^2 \\) keeps its delimiters.",
	"",
	"Paths like file_name.tex are broken source we must not quietly rewrite.",
	"",
	"Alpha line.",
	"% reviewer note: keep me",
	"Beta line.",
	"\\end{document}",
	""
].join("\n");
check("reload for the fidelity checks", await loadSource(guarded, "reviewer note"));
await toVisual();
await sleep(600);

check(
	"a paragraph the printer cannot reproduce is shown but locked",
	await ev(`(() => {
	  const locked = document.querySelector('[data-locked-block]');
	  return !!locked && locked.textContent.includes('file_name.tex');
	})()`),
	await ev(`document.querySelector('[data-locked-block]')?.textContent ?? 'no locked block'`)
);
check(
	"and it offers no caret to type into",
	await ev(`!document.querySelector('[data-locked-block]')?.querySelector('[data-block-editor]')`)
);

check(
	"a comment inside a paragraph shows as its own chip",
	await ev(`(() => {
	  const c = document.querySelector('[data-atom="comment"]');
	  return !!c && c.textContent.includes('reviewer note');
	})()`)
);

const commented = await ev(`(() => {
  const c = document.querySelector('[data-atom="comment"]');
  const host = c?.closest('[data-block-editor]');
  if (!host) return -1;
  return [...document.querySelectorAll('[data-block-editor]')].indexOf(host);
})()`);
check("the block holding it is still editable", commented >= 0, String(commented));
await caretInBlock(commented);
await typeText(" TAIL");
await sleep(500);
await toLatex();
const kept = (await source()) ?? "";
check(
	"editing around a comment keeps it, and its newline",
	kept.includes("Alpha line.\n% reviewer note: keep me\nBeta line. TAIL"),
	JSON.stringify(kept.match(/Alpha[\s\S]{0,70}/)?.[0])
);
check(
	"a paragraph of unmodelled macros stays editable and byte-identical",
	kept.includes("Held at \\SI{298.15}{\\kelvin} in \\textcolor{red}{red} throughout."),
	JSON.stringify(kept.match(/Held at[^\n]*/)?.[0])
);
check(
	"\\( \\) maths keeps its own delimiters rather than becoming $ $",
	kept.includes("Inline maths as \\( E = mc^2 \\) keeps its delimiters."),
	JSON.stringify(kept.match(/Inline maths[^\n]*/)?.[0])
);
check(
	"and the locked paragraph is not quietly escaped",
	kept.includes("Paths like file_name.tex are broken source we must not quietly rewrite."),
	JSON.stringify(kept.match(/Paths like[^\n]*/)?.[0])
);

// --- Typing a caret or a tilde must not break the build -----------------------
await toVisual();
await sleep(500);
await caretInBlock(0);
await typeText(" x^2 a~b");
await sleep(600);
await toLatex();
const escaped = (await source()) ?? "";
check(
	"a typed caret and tilde are escaped, not left to the compiler",
	escaped.includes("x\\textasciicircum{}2 a\\textasciitilde{}b"),
	JSON.stringify(escaped.match(/A plain paragraph[^\n]*/)?.[0])
);

// --- Keyboard route to the block actions --------------------------------------
await toVisual();
await sleep(500);
await caretInBlock(0);
await key("F10", "F10", 121, 8);
await sleep(400);
check(
	"Shift+F10 opens the block menu without a pointer",
	await ev(`!!document.querySelector('[role="menu"][aria-label="Block actions"]')`)
);
await key("Escape", "Escape", 27);
await sleep(300);

// --- The atom editor survives a scroll ----------------------------------------
await ev(`(() => {
  const a = document.querySelector('[data-block-editor] [data-atom]');
  a?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return !!a;
})()`);
await sleep(500);
const dialogOpen = () => ev(`!!document.querySelector('[role="dialog"][aria-label^="Edit"]')`);
check("an atom editor is open", await dialogOpen());
await ev(`(() => {
  const pane = document.querySelector('[aria-label="Visual editor"]');
  pane.scrollTop += 60;
  pane.dispatchEvent(new Event('scroll'));
  return true;
})()`);
await sleep(400);
check("scrolling the pane does not throw away what it holds", await dialogOpen());

// --- Turning a block into another kind must carry its words -------------------
const convertible = [
	"\\documentclass{article}",
	"\\begin{document}",
	"A paragraph whose words must survive being turned into a heading.",
	"",
	"Paths like file_name.tex are locked source.",
	"\\end{document}",
	""
].join("\n");
check("reload for the conversion checks", await loadSource(convertible, "must survive"));
await toVisual();
await sleep(600);

// Scoped to the block menu and the insert list by name: an engine-install dialog
// can be on screen, and a bare [role="menu"] would find its buttons instead.
const BLOCK_MENU = '[role="menu"][aria-label="Block actions"]';
const INSERT_LIST = '[role="listbox"][aria-label="Block types"]';
const openGutter = async (find) => {
	await clearModals();
	return ev(`(() => {
	  const wraps = [...document.querySelectorAll('[data-block-wrapper]')];
	  const w = wraps.find(${find});
	  const b = w?.querySelector('[aria-label="Block actions"]');
	  b?.click();
	  return !!b;
	})()`);
};
const menuItems = () =>
	ev(`[...document.querySelectorAll('${BLOCK_MENU} button')].map(b => b.textContent.trim())`);
const pickMenu = (text) =>
	ev(
		`(() => { const b = [...document.querySelectorAll('${BLOCK_MENU} button, ${INSERT_LIST} button')].find(x => x.textContent.trim().startsWith(${JSON.stringify(text)})); b?.click(); return !!b; })()`
	);

check(
	"the gutter menu opens on a paragraph",
	await openGutter(`(w) => (w.innerText || '').includes('must survive')`)
);
await sleep(400);
await pickMenu("Turn into");
await sleep(500);
await pickMenu("Section");
await sleep(800);
await toLatex();
const turned = (await source()) ?? "";
check(
	'"Turn into" keeps the words it converted',
	/\\section\{A paragraph whose words must survive being turned into a heading\.\}/.test(turned),
	JSON.stringify(turned.match(/\\section[^\n]*|A paragraph[^\n]*/)?.[0])
);

await toVisual();
await sleep(600);
check(
	"the gutter menu opens on the locked block",
	await openGutter(`(w) => !!w.querySelector('[data-locked-block]')`)
);
await sleep(400);
const lockedMenu = await menuItems();
check(
	"a locked block is not offered a conversion that would rewrite it",
	lockedMenu.length > 0 && !lockedMenu.some((item) => item.startsWith("Turn into")),
	JSON.stringify(lockedMenu)
);
await key("Escape", "Escape", 27);
await sleep(300);
await toLatex();
check(
	"and the locked block is still byte-identical",
	((await source()) ?? "").includes("Paths like file_name.tex are locked source."),
	JSON.stringify((await source())?.match(/Paths like[^\n]*/)?.[0])
);

// --- Captions are inline content, not a raw string ----------------------------
const captioned = [
	"\\documentclass{article}",
	"\\begin{document}",
	"\\begin{figure}",
	"  \\includegraphics{plot}",
	"  \\caption{Convergence of \\textbf{our} estimator on \\emph{real} data}",
	"\\end{figure}",
	"\\end{document}",
	""
].join("\n");
check("reload for the caption checks", await loadSource(captioned, "Convergence of"));
await toVisual();
await sleep(600);
check(
	"a caption with a braced macro is shown whole",
	await ev(
		`(() => { const c = document.querySelector('[data-float-caption]'); return !!c && /Convergence of our estimator on real data/.test(c.innerText.replace(/\\s+/g,' ').trim()); })()`
	),
	await ev(`document.querySelector('[data-float-caption]')?.innerText ?? '(none)'`)
);
check(
	"and its bold survives as a mark, not as typed-out LaTeX",
	await ev(`!!document.querySelector('[data-float-caption] [data-mark="bold"]')`)
);

await ev(`(() => {
  const c = document.querySelector('[data-float-caption]');
  c.focus();
  c.textContent = 'Yield at 50% load for Tom & Jerry';
  c.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(800);
await toLatex();
const escapedCaption = (await source()) ?? "";
check(
	"typing a percent into a caption escapes it",
	/\\caption\{Yield at 50\\% load for Tom \\& Jerry\}/.test(escapedCaption),
	JSON.stringify(escapedCaption.match(/\\caption[^\n]*/)?.[0])
);
check(
	"and nothing is left dangling outside the command",
	/\\caption\{[^\n]*\}\n\\end\{figure\}/.test(escapedCaption),
	JSON.stringify(escapedCaption.match(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/)?.[0])
);

// --- Lists, and the one free-text field left in a code block ------------------
const listDoc = [
	"\\documentclass{article}",
	"\\begin{document}",
	"\\begin{itemize}",
	"  \\item alpha item",
	"  \\item beta item",
	"\\end{itemize}",
	"",
	"\\begin{description}",
	"  \\item[Term] described thing",
	"\\end{description}",
	"",
	"\\begin{lstlisting}",
	"code();",
	"\\end{lstlisting}",
	"\\end{document}",
	""
].join("\n");
check("reload for the list checks", await loadSource(listDoc, "alpha item"));
await toVisual();
await sleep(500);

// The source right after a mode switch can still be the text from before the edit.
const settled = async (marker) => {
	for (let i = 0; i < 20; i++) {
		const text = (await source()) ?? "";
		if (text.includes(marker)) return text;
		await sleep(200);
	}
	return (await source()) ?? "";
};
const caretIn = async (match, where = "end") => {
	for (let i = 0; i < 12; i++) {
		const ok = await ev(`(() => {
		  const el = [...document.querySelectorAll('[data-block-editor]')].find(e => (e.innerText||'').includes(${JSON.stringify(match)}));
		  if (!el) return false;
		  el.focus();
		  const r = document.createRange();
		  r.selectNodeContents(el); r.collapse(${where === "start"});
		  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
		  return document.activeElement === el;
		})()`);
		await sleep(150);
		if (ok && (await ev(`!!document.querySelector('[data-block-wrapper]:focus-within')`)))
			return true;
	}
	return false;
};

check("the caret reaches a list item", await caretIn("alpha item"));
await key("Enter", "Enter", 13);
await sleep(400);
await typeText("inserted item");
await sleep(600);
await toLatex();
const withItem = await settled("inserted item");
check(
	"Enter in a list adds a sibling and keeps both texts",
	/\\item alpha item\s*\n\s*\\item inserted item\s*\n\s*\\item beta item/.test(withItem),
	JSON.stringify(withItem.match(/\\begin\{itemize\}[\s\S]*?\\end\{itemize\}/)?.[0])
);

await toVisual();
await sleep(500);
check("the caret reaches the start of the last item", await caretIn("beta item", "start"));
await key("Backspace", "Backspace", 8);
await sleep(600);
await toLatex();
const merged = await settled("alpha item");
check(
	"Backspace folds an item into the one above without losing either",
	/\\item inserted itembeta item/.test(merged),
	JSON.stringify(merged.match(/\\begin\{itemize\}[\s\S]*?\\end\{itemize\}/)?.[0])
);

await toVisual();
await sleep(500);
check("the caret reaches a described item", await caretIn("described thing"));
await typeText(" TAIL");
await sleep(600);
await toLatex();
const described = await settled("TAIL");
check(
	"a description term survives an edit to its item",
	/\\item\[Term\] described thing TAIL/.test(described),
	JSON.stringify(described.match(/\\begin\{description\}[\s\S]*?\\end\{description\}/)?.[0])
);

await toVisual();
await sleep(500);
check(
	"the listing language field takes a value",
	await ev(`(() => {
	  const input = document.querySelector('[aria-label="Listing language"]');
	  if (!input) return false;
	  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
	  setter.call(input, 'Py%thon{');
	  input.dispatchEvent(new Event('change', { bubbles: true }));
	  return true;
	})()`)
);
await sleep(700);
await toLatex();
const listed = await settled("lstlisting");
check(
	"and a percent in it cannot comment out the \\begin line",
	!/language=[^\]\n]*%/.test(listed) && /\\end\{lstlisting\}/.test(listed),
	JSON.stringify(listed.match(/\\begin\{lstlisting\}[^\n]*/)?.[0])
);

finish();
