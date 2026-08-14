// Editor behaviour that only shows up in a real browser:
//  - toolbar actions must land the edit AND leave the caret in the editor
//    (dropdown menus are the trap: bits-ui returns focus to its trigger on close)
//  - sticky headings must track the scroll position, not freeze on the first one
//  - visual mode must project the real document, not a specimen
import fs from 'node:fs';
import path from 'node:path';
import { connect, sleep } from './harness.mjs';

const { send, ev, check, clearModals, clickAt, clickSel, key, typeText, focusInfo, focusDoc, openProject, finish } =
	await connect();

const route = await openProject();
check('project opens in the LaTeX view', route.includes('/projects/') && (await ev(`!!document.querySelector('.cm-content')`)), route);
check('editor takes focus from a click', await focusDoc());

const docText = () => ev(`document.querySelector('.cm-content').innerText`);
const clickMenuItem = async (text) => {
	const box = await ev(`(() => {
	  const el = [...document.querySelectorAll('[data-slot="dropdown-menu-item"]')]
	    .find(i => i.textContent.trim().startsWith(${JSON.stringify(text)}));
	  if (!el) return null;
	  const r = el.getBoundingClientRect();
	  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
	})()`);
	if (!box) return false;
	await clickAt(box.x, box.y);
	await sleep(300);
	return true;
};

// --- Direct toolbar button ---------------------------------------------------
const beforeBold = await docText();
await clickSel('[aria-label="Bold"]');
check('Bold inserts \\textbf', (await docText()).includes('\\textbf{') && (await docText()) !== beforeBold);
check('Bold leaves focus in the editor', (await focusInfo()).isContent, JSON.stringify(await focusInfo()));

// --- Dropdown menu item ------------------------------------------------------
await clickSel('[aria-label="Heading"]');
await sleep(400);
check('Heading menu opens', await ev(`!!document.querySelector('[data-slot="dropdown-menu-content"]')`));
await clickMenuItem('Section');
await sleep(400);
check('Section inserts \\section', (await docText()).includes('\\section{'));
check('menu item leaves focus in the editor', (await focusInfo()).isContent, JSON.stringify(await focusInfo()));

// --- Selection is wrapped, and survives --------------------------------------
await focusDoc();
await key('End', 'End', 35, 2);
await key('Enter', 'Enter', 13);
await typeText('needle');
await key('Home', 'Home', 36, 8);
await sleep(250);
await clickSel('[aria-label="Bold"]');
check('Bold wraps the selected text', /\\textbf\{needle\}/.test(await docText()));
check('the wrapped text stays selected', (await ev(`window.getSelection().toString()`)) === 'needle');

// --- A block goes on its own line, not spliced mid-paragraph -----------------
await focusDoc();
await key('End', 'End', 35, 2);
await key('Enter', 'Enter', 13);
await typeText('Hello');
await sleep(200);
await clickSel('[aria-label="List"]');
await sleep(400);
await clickMenuItem('Bulleted list');
const listed = (await docText()).replace(/\r/g, '');
check('block insert starts on its own line', /Hello\n\\begin\{itemize\}/.test(listed),
	JSON.stringify(listed.slice(listed.lastIndexOf('Hello'), listed.lastIndexOf('Hello') + 32)));
check('block insert leaves focus in the editor', (await focusInfo()).isContent);

// --- Find bar keeps its own focus -------------------------------------------
await focusDoc();
await key('f', 'KeyF', 70, 2);
await sleep(700);
const findOpen = await ev(`!!document.querySelector('input[placeholder*="Find" i], input[aria-label*="Find" i]')`);
check('Ctrl+F opens the find bar', findOpen);
if (findOpen) {
	const beforeFind = await docText();
	await typeText('e');
	await sleep(500);
	await key('Enter', 'Enter', 13);
	const first = await focusInfo();
	await key('Enter', 'Enter', 13);
	const second = await focusInfo();
	check('find: focus stays in the input after Enter', first.tag === 'input', JSON.stringify(first));
	// Regression guard: if focus jumps to the editor, the second Enter types a
	// newline into the user's document instead of finding the next match.
	check('find: focus survives a second Enter', second.tag === 'input', JSON.stringify(second));
	check('find: Enter never edits the document', (await docText()) === beforeFind);
	await key('Escape', 'Escape', 27);
	await sleep(300);
}

// --- Load a realistic document for the remaining checks ----------------------
const fixture = fs.readFileSync(path.join(import.meta.dirname, '..', 'fixtures', 'article.tex'), 'utf8');
let loaded = false;
for (let attempt = 0; attempt < 3 && !loaded; attempt++) {
	await clearModals();
	await focusDoc();
	await key('a', 'KeyA', 65, 2);
	await sleep(200);
	await send('Input.insertText', { text: fixture });
	await sleep(1200);
	loaded = await ev(`document.querySelector('.cm-content').innerText.includes('Consistency of Estimators')`);
}
check('fixture document loads', loaded);

// --- Sticky headings track the scroll position -------------------------------
// Scroll by a fraction of the range: a fixed pixel target clamps on a short
// document and silently tests the top of the file instead.
const stickyAt = async (fraction) => {
	await ev(`(() => { const s = document.querySelector('.cm-scroller'); if (!s) return null;
	  s.scrollTop = Math.round((s.scrollHeight - s.clientHeight) * ${fraction}); return s.scrollTop; })()`);
	await sleep(600);
	return ev(`(() => { const s = document.querySelector('.cm-tex-sticky'); if (!s) return null;
	  return { rows: s.children.length, text: s.innerText.replace(/\\n/g, ' '),
	           hidden: getComputedStyle(s).display === 'none' }; })()`);
};
const atTop = await stickyAt(0);
check('sticky: nothing pinned at the top of the document', atTop && atTop.hidden, JSON.stringify(atTop));
const inSection = await stickyAt(0.55);
// Regression guard: reading layout inside update() throws, CodeMirror disables
// the plugin, and the strip then freezes on whatever it showed first.
check('sticky: pins the enclosing \\section', inSection && inSection.rows >= 1 && /section\{/.test(inSection.text),
	JSON.stringify(inSection));
check('sticky: shows the real source line, not a stripped title',
	!!inSection && inSection.text.includes('\\section{'), JSON.stringify(inSection?.text));

// --- Visual mode projects the real document ----------------------------------
await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^visual$/i.test((x.textContent||'').trim())); b?.click(); return !!b; })()`);
await sleep(4000);
check('visual pane renders', await ev(`!!document.querySelector('[aria-label="Visual editor"]')`));

const shape = await ev(`(() => {
  const a = document.querySelector('.glyphtex-doc');
  if (!a) return null;
  return {
    headings: a.querySelectorAll('h2,h3,h4').length,
    lists: a.querySelectorAll('ul,ol').length,
    figures: a.querySelectorAll('figure').length,
    blocks: a.children.length,
    strayLabels: [...a.querySelectorAll('p')].filter(p => /^#?\\S*$/.test(p.innerText.trim()) && p.innerText.includes('sec:')).length,
  };
})()`);
check('projects the sectioning ladder', shape && shape.headings >= 4, JSON.stringify(shape));
check('projects lists and the figure', shape && shape.lists >= 2 && shape.figures >= 1, JSON.stringify(shape));
check('a standalone \\label never becomes its own paragraph', shape && shape.strayLabels === 0);
check('preamble is summarised, not projected as body',
	(await ev(`(() => { const a = document.querySelector('.glyphtex-doc'); return a ? !/documentclass|usepackage/.test(a.textContent) : false; })()`)));

// Clicking a block returns to the source with that range selected.
await ev(`(() => { const h = document.querySelector('.glyphtex-doc h2'); h?.closest('[role="button"]')?.click(); return !!h; })()`);
await sleep(2500);
check('clicking a block opens it in the LaTeX view', await ev(`!!document.querySelector('.cm-content')`));
check('and selects that block in the source',
	/\\section\{/.test(await ev(`window.getSelection().toString()`)),
	JSON.stringify((await ev(`window.getSelection().toString()`)).slice(0, 40)));

finish();
