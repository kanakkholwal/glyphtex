// Visual mode must be editable, and every edit must land in the LaTeX source
// without disturbing anything it did not touch. Only a real browser can test
// this: the surface is contenteditable, and the model is read back off the DOM.
import fs from 'node:fs';
import path from 'node:path';
import { connect, sleep } from './harness.mjs';

const { send, ev, check, clearModals, key, typeText, editorDoc, focusDoc, openProject, finish } =
	await connect();

await openProject();
await focusDoc();

// --- Load a document with something worth not breaking ------------------------
const fixture = fs.readFileSync(
	path.join(import.meta.dirname, '..', 'fixtures', 'tikz.tex'),
	'utf8'
);
const article = fs.readFileSync(
	path.join(import.meta.dirname, '..', 'fixtures', 'article.tex'),
	'utf8'
);
const source = editorDoc;

async function loadSource(text, marker) {
	for (let attempt = 0; attempt < 3; attempt++) {
		await clearModals();
		await focusDoc();
		await key('a', 'KeyA', 65, 2);
		await sleep(150);
		await send('Input.insertText', { text });
		await sleep(900);
		if ((await source())?.includes(marker)) return true;
	}
	return false;
}

check('fixture loads in the LaTeX view', await loadSource(article, 'Consistency of Estimators'));

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

check('visual mode renders editable blocks', await toVisual());

// Click into the nth editable block and put the caret at its end.
const caretInBlock = (n, where = 'end') =>
	ev(`(() => {
	  const el = document.querySelectorAll('[data-block-editor]')[${n}];
	  if (!el) return false;
	  el.focus();
	  const r = document.createRange();
	  r.selectNodeContents(el);
	  r.collapse(${where === 'start'});
	  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
	  return document.activeElement === el;
	})()`);

const blockText = (n) =>
	ev(`document.querySelectorAll('[data-block-editor]')[${n}]?.innerText.trim()`);

// --- Typing into a paragraph reaches the source -------------------------------
check('a block takes the caret', await caretInBlock(1));
await typeText(' EDITED');
await sleep(400);
check('the typed text shows in the block', (await blockText(1))?.endsWith('EDITED'));

check('back to LaTeX', await toLatex());
const afterTyping = await source();
check(
	'the edit landed in the LaTeX source',
	afterTyping?.includes('EDITED'),
	'not found in source'
);
check(
	'the rest of the document is untouched',
	afterTyping?.includes('\\begin{figure}') && afterTyping?.includes('\\includegraphics'),
	'a float was rewritten'
);

// --- Round trip: visual -> latex -> visual -> latex must settle ---------------
await toVisual();
await sleep(600);
await toLatex();
const secondTrip = await source();
check(
	'a second round trip changes nothing',
	secondTrip === afterTyping,
	'the document drifts every time you switch modes'
);

// --- Enter opens a new block, and typing materialises it ----------------------
await toVisual();
await caretInBlock(1);
await key('Enter', 'Enter', 13);
await sleep(300);
await typeText('A brand new paragraph.');
await sleep(500);
await toLatex();
const afterEnter = await source();
check('Enter then typing creates a real paragraph', afterEnter?.includes('A brand new paragraph.'));
check(
	'the new paragraph is its own block, not glued on',
	/\n\s*\n\s*A brand new paragraph\./.test(afterEnter ?? ''),
	JSON.stringify(
		afterEnter?.slice(
			Math.max(0, (afterEnter?.indexOf('A brand new') ?? 0) - 30),
			(afterEnter?.indexOf('A brand new') ?? 0) + 30
		)
	)
);

// --- Input rule: "## " turns an empty block into a subsection -----------------
await toVisual();
await caretInBlock(1);
await key('Enter', 'Enter', 13);
await sleep(300);
await typeText('## ');
await sleep(600);
await typeText('Ruled Heading');
await sleep(500);
await toLatex();
check(
	'"## " converts to a subsection',
	/\\subsection\{Ruled Heading\}/.test((await source()) ?? ''),
	'input rule did not fire'
);

// --- Slash menu inserts a block ------------------------------------------------
await toVisual();
await caretInBlock(1);
await key('Enter', 'Enter', 13);
await sleep(300);
await send('Input.dispatchKeyEvent', {
	type: 'keyDown',
	key: '/',
	code: 'Slash',
	windowsVirtualKeyCode: 191
});
await send('Input.dispatchKeyEvent', {
	type: 'keyUp',
	key: '/',
	code: 'Slash',
	windowsVirtualKeyCode: 191
});
await sleep(500);
check('the slash menu opens', await ev(`!!document.querySelector('[aria-label="Insert block"]')`));
await typeText('equat');
await sleep(400);
await key('Enter', 'Enter', 13);
await sleep(600);
await toLatex();
check('picking Equation inserts one', /\\begin\{equation\}/.test((await source()) ?? ''));

// --- Everything the LaTeX toolbar inserts is reachable here too ----------------
check('reload for the parity checks', await loadSource(article, 'Consistency of Estimators'));
await toVisual();
await caretInBlock(1);
await key('Enter', 'Enter', 13);
await sleep(300);
const slash = async (modifiers = 0) => {
	for (const type of ['keyDown', 'keyUp'])
		await send('Input.dispatchKeyEvent', {
			type,
			key: '/',
			code: 'Slash',
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
	'the insert menu groups its entries',
	!!offered && offered.groups.length >= 4,
	JSON.stringify(offered?.groups)
);
for (const wanted of ['Part', 'Chapter', 'Matrix', 'Cases', 'Display maths', 'Description list']) {
	check(
		`the / menu offers ${wanted}`,
		!!offered?.labels.includes(wanted),
		JSON.stringify(offered?.labels)
	);
}
await key('Escape', 'Escape', 27);
await sleep(300);

// --- An inline atom can be inserted at the caret, not only edited --------------
// Ctrl+/ rather than a bare slash: the caret sits tight against a word, where a
// bare slash is a character the writer meant to type.
await caretInBlock(1);
await slash(2);
check(
	'Ctrl+/ opens the menu against a word',
	await ev(`!!document.querySelector('[aria-label="Insert block"]')`)
);
check(
	'the menu offers inline things when there is a caret',
	await ev(
		`[...document.querySelectorAll('[role="option"]')].some(o => o.textContent.trim() === 'Footnote')`
	)
);
await typeText('footnote');
await sleep(400);
await key('Enter', 'Enter', 13);
await sleep(600);
check(
	'picking Footnote opens its editor',
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
	'the footnote lands in the LaTeX source',
	/\\footnote\{A note from the visual editor\.\}/.test((await source()) ?? ''),
	JSON.stringify((await source())?.match(/\\footnote\{[^}]*\}/)?.[0])
);

// --- Selection formatting -----------------------------------------------------
check('reload for the selection checks', await loadSource(article, 'Consistency of Estimators'));
await toVisual();
await sleep(500);

// Select the first word of a paragraph and bold it from the floating bar.
const selectedWord = await ev(`(() => {
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
await sleep(400);
check(
	'a selection raises the format bar',
	await ev(`!!document.querySelector('[aria-label="Format selection"]')`),
	String(selectedWord)
);

await ev(
	`(() => { const b = document.querySelector('[aria-label="Format selection"] [aria-label="Bold"]'); b?.click(); return !!b; })()`
);
await sleep(600);
await toLatex();
check(
	'the format bar writes \\textbf into the source',
	/\\textbf\{/.test((await source()) ?? ''),
	'no bold reached the source'
);

// The overflow is where the other eight marks live; small caps must not come
// back as \emph, which is what the old single mark kind did to it.
await toVisual();
await sleep(500);
await ev(`(() => {
  const el = [...document.querySelectorAll('[data-block-editor]')].find(e => (e.innerText||'').trim().length > 30);
  const node = [...el.childNodes].find(n => n.nodeType === 3 && n.nodeValue.trim().length > 4);
  el.focus();
  const r = document.createRange();
  r.setStart(node, 0); r.setEnd(node, 4);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.dispatchEvent(new Event('selectionchange'));
  return true;
})()`);
await sleep(400);
await ev(
	`(() => { const b = document.querySelector('[aria-label="More formatting"]'); b?.click(); return !!b; })()`
);
await sleep(300);
check(
	'the format bar has an overflow with the rest of the marks',
	(await ev(
		`document.querySelectorAll('[aria-label="More formatting"][role="menu"] [role="menuitem"]').length`
	)) >= 7
);
await ev(`(() => {
  const item = [...document.querySelectorAll('[role="menuitem"]')].find(i => i.textContent.includes('Small caps'));
  item?.click();
  return !!item;
})()`);
await sleep(600);
await toLatex();
check(
	'small caps writes \\textsc, not \\emph',
	/\\textsc\{/.test((await source()) ?? ''),
	JSON.stringify((await source())?.match(/\\text(sc|it)\{[^}]*\}/)?.[0])
);

// --- Atoms are editable, not read-only holes ----------------------------------
check('reload for the atom checks', await loadSource(article, 'Consistency of Estimators'));
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
	'clicking a citation opens its editor',
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
	'editing a citation rewrites its keys',
	/\\citep?\{[^}]*replaced2026/.test((await source()) ?? ''),
	JSON.stringify((await source())?.match(/\\cite\w*\{[^}]*\}/)?.[0])
);

// --- Cross-block selection must not corrupt the document ----------------------
check('reload for the cross-block check', await loadSource(article, 'Consistency of Estimators'));
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
await key('Backspace', 'Backspace', 8);
await sleep(600);
await toLatex();
check(
	'a selection spanning two blocks is refused, not applied',
	(await source()) === beforeCross,
	'a cross-block delete mutated the document'
);

// --- A figure is editable where it can be, verbatim everywhere else -----------
check('reload the article', await loadSource(article, 'Consistency of Estimators'));
await toVisual();
await sleep(500);
check(
	'the figure renders as a card with its caption',
	await ev(
		`(() => { const c = document.querySelector('[data-float-caption]'); return !!c && /Empirical convergence/.test(c.textContent); })()`
	)
);

await ev(`(() => {
  const c = document.querySelector('[data-float-caption]');
  c.focus();
  c.textContent = 'A rewritten caption.';
  c.dispatchEvent(new FocusEvent('blur'));
  return true;
})()`);
await sleep(700);
await toLatex();
const afterCaption = await source();
check(
	'editing the caption rewrites only the caption',
	/\\caption\{A rewritten caption\.\}/.test(afterCaption ?? '')
);
check(
	'the graphic and its options are untouched',
	afterCaption?.includes('\\includegraphics[width=0.7\\linewidth]{figures/convergence}'),
	'the includegraphics line was rewritten'
);
check(
	'the figure label survives a caption edit',
	afterCaption?.includes('\\label{fig:convergence}')
);

await toVisual();
await sleep(500);
await ev(
	`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Full' && x.closest('figure')); b?.click(); return !!b; })()`
);
await sleep(700);
await toLatex();
check(
	'the width control rewrites only width=',
	/\\includegraphics\[width=\\linewidth\]\{figures\/convergence\}/.test((await source()) ?? ''),
	JSON.stringify((await source())?.match(/\\includegraphics[^\n]*/)?.[0])
);

// --- A block we do not model is never rewritten -------------------------------
check('tikz fixture loads', await loadSource(fixture, 'tikzpicture'));
const beforeTikz = await source();
await toVisual();
await sleep(500);
const rawChips = await ev(
	`document.querySelectorAll('[aria-label="Visual editor"] .border-dashed').length`
);
check('a tikzpicture shows as an inert chip', rawChips >= 1, `chips: ${rawChips}`);
await toLatex();
check('opening it in visual mode changed nothing', (await source()) === beforeTikz);

// --- Undo ---------------------------------------------------------------------
await toVisual();
await caretInBlock(0);
await typeText('ZZZ');
await sleep(500);
await key('z', 'KeyZ', 90, 2);
await sleep(500);
await toLatex();
check(
	'Ctrl+Z reverts a visual edit',
	!(await source())?.includes('ZZZ'),
	'the undo stack missed it'
);

finish();
