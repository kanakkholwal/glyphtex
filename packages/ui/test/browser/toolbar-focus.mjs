// Guards the toolbar/editor binding: every action must land the edit in the
// document AND leave the caret in the editor. Dropdown menus are the trap —
// bits-ui returns focus to the trigger after close, stranding the caret there.
const CDP = process.env.CDP || 'http://127.0.0.1:9333';
const PAGE = process.env.PAGE || 'http://localhost:5173/workspace';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`${CDP}/json/list`)).json();
const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) throw new Error('no CDP page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
	const m = JSON.parse(e.data);
	if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) =>
	new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (expression) => {
	const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
	const d = r.result?.exceptionDetails;
	if (d) throw new Error(d.exception?.description ?? d.text);
	return r.result?.result?.value;
};

const results = [];
const check = (name, pass, detail = '') => {
	results.push({ name, pass });
	console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const key = async (k, code, vk, modifiers = 0, text) => {
	await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers });
	if (text) await send('Input.dispatchKeyEvent', { type: 'char', text, unmodifiedText: text, key: k, modifiers });
	await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers });
	await sleep(120);
};
const typeText = async (s) => { for (const ch of s) await key(ch, undefined, ch.charCodeAt(0), 0, ch); };

const clickAt = async (x, y) => {
	for (const type of ['mousePressed', 'mouseReleased'])
		await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
	await sleep(350);
};
const clickSel = async (sel) => {
	const box = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
	  const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
	if (!box) return false;
	await clickAt(box.x, box.y);
	return true;
};
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

const focusInfo = () => ev(`(() => {
  const a = document.activeElement;
  return { tag: a?.tagName.toLowerCase(), isContent: !!a?.classList?.contains('cm-content'),
           label: (a?.getAttribute('aria-label') || a?.placeholder || '').slice(0, 30) };
})()`);
const docText = () => ev(`document.querySelector('.cm-content').innerText`);

// The install dialog's overlay covers the whole viewport and swallows clicks.
// `data-dialog-overlay` is the attribute that matters; missing it silently makes
// every synthetic click a no-op.
const clearModals = () => ev(`(() => {
  document.querySelectorAll('[role="dialog"],[data-slot="dialog-overlay"],[data-dialog-overlay]').forEach(e => e.remove());
  document.body.style.pointerEvents = ''; document.body.removeAttribute('data-scroll-locked');
  return document.querySelectorAll('[data-slot="dialog-overlay"]').length;
})()`);

// Click the first line rather than the pane centre, which a late overlay can cover.
const focusDoc = async () => {
	for (let i = 0; i < 3; i++) {
		const b = await ev(`(() => { const e = document.querySelector('.cm-line'); if (!e) return null;
		  const r = e.getBoundingClientRect(); return { x: Math.round(r.x + 20), y: Math.round(r.y + r.height / 2) }; })()`);
		if (b) await clickAt(b.x, b.y);
		if ((await focusInfo()).isContent) return true;
		await clearModals();
	}
	return false;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: PAGE });
await sleep(5000);

await ev(`(() => {
	const link = document.querySelector('a[href*="/workspace/projects/"]');
	if (link) { link.click(); return 'existing'; }
	[...document.querySelectorAll('button')]
		.find(b => (b.getAttribute('aria-label') || b.textContent || '').trim() === 'New project')?.click();
	return 'created';
})()`);

let ready = false;
for (let i = 0; i < 80; i++) {
	await sleep(500);
	ready = await ev(`!!document.querySelector('.cm-content')`).catch(() => false);
	if (ready) break;
}
check('editor mounts', ready, await ev(`location.pathname`));
if (!ready) { ws.close(); process.exit(1); }
await sleep(1500);
await clearModals();
check('editor takes focus from a click', await focusDoc());

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
}

ws.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
