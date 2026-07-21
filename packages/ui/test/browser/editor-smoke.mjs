// Must not import the editor modules: under Vite that loads a second copy and
// registers the providers twice, surfacing as duplicated suggestions.
const CDP = process.env.CDP || 'http://127.0.0.1:9333';
const PAGE = process.env.PAGE || 'http://localhost:5199/editor';
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
const evaluate = async (expression) => {
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

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: PAGE });

let mounted = false;
for (let i = 0; i < 80; i++) {
	await sleep(500);
	mounted = await evaluate(`!!document.querySelector('.monaco-editor')`).catch(() => false);
	if (mounted) break;
}
check('Monaco editor mounts', mounted);
if (!mounted) { ws.close(); process.exit(1); }
await sleep(1500);

const box = await evaluate(`(() => { const r = document.querySelector('.monaco-editor').getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height)}; })()`);
check('editor has non-zero size', box.w > 100 && box.h > 100, `${box.w}x${box.h}`);

const bg = await evaluate(`getComputedStyle(document.querySelector('.monaco-editor .monaco-editor-background') || document.querySelector('.monaco-editor')).backgroundColor`);
check('Islands Dark background', /rgb\(25,\s*26,\s*28\)/.test(bg), bg);

const tokens = await evaluate(`(() => {
	const spans = [...document.querySelectorAll('.monaco-editor .view-line span span')];
	const classes = new Set(spans.map(s => [...s.classList].find(c => c.startsWith('mtk'))).filter(Boolean));
	return { spans: spans.length, distinct: classes.size };
})()`);
check('grammar produces distinct token classes', tokens.distinct > 2, `${tokens.distinct} classes / ${tokens.spans} spans`);

// The install dialog traps focus by design; remove it so the editor is reachable.
await evaluate(`(() => {
	document.querySelectorAll('[role="dialog"],[data-dialog-overlay],[data-bits-dialog-overlay],[data-melt-dialog-overlay]').forEach(e => e.remove());
	document.body.style.pointerEvents = '';
	document.body.removeAttribute('data-scroll-locked');
	return true;
})()`);
await sleep(300);

const target = await evaluate(`(() => { const r = document.querySelector('.monaco-editor .view-lines').getBoundingClientRect(); return {x: Math.round(r.x + 40), y: Math.round(r.y + 10)}; })()`);
for (const type of ['mousePressed', 'mouseReleased']) {
	await send('Input.dispatchMouseEvent', { type, x: target.x, y: target.y, button: 'left', clickCount: 1 });
}
await sleep(400);

for (const [key, code, vk] of [['End', 'End', 35], ['Enter', 'Enter', 13]]) {
	await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, modifiers: key === 'End' ? 2 : 0 });
	await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers: key === 'End' ? 2 : 0 });
	await sleep(200);
}

async function type(text) {
	for (const ch of text) {
		await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch });
		await send('Input.dispatchKeyEvent', { type: 'char', text: ch, unmodifiedText: ch, key: ch });
		await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
		await sleep(90);
	}
	await sleep(1100);
}

const widgetState = () => evaluate(`(() => {
	const w = document.querySelector('.suggest-widget');
	return {
		visible: !!w && w.classList.contains('visible') && w.offsetHeight > 0,
		rows: [...document.querySelectorAll('.suggest-widget .monaco-list-row')].map(r => r.textContent.trim()),
	};
})()`);

await type(String.fromCharCode(92) + 'fra');
const cmd = await widgetState();
check('suggest widget opens on a partial command', cmd.visible, cmd.rows.slice(0, 3).join(' | '));
check('offers \\frac', cmd.rows.some((r) => r.includes('frac')), cmd.rows[0] ?? '(none)');
check('no duplicate suggestions', new Set(cmd.rows).size === cmd.rows.length, `${cmd.rows.length} rows, ${new Set(cmd.rows).size} unique`);

await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await sleep(200);
for (let i = 0; i < 4; i++) {
	await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
	await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
	await sleep(80);
}

await type(String.fromCharCode(92) + 'begin{itemi');
const env = await widgetState();
check('environment completion inside \\begin{', env.visible, env.rows.slice(0, 3).join(' | '));
check('offers itemize', env.rows.some((r) => r.startsWith('itemize')), env.rows[0] ?? '(none)');

ws.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
