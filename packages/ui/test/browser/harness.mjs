// Shared CDP plumbing for the browser suites. Requires a dev server and a
// Chrome started with --remote-debugging-port; see README.md.
export const CDP = process.env.CDP || 'http://127.0.0.1:9333';
export const PAGE = process.env.PAGE || 'http://localhost:5173/workspace';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connect() {
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

	// The engine-install dialog's overlay covers the whole viewport and silently
	// eats every synthetic click. `data-dialog-overlay` is the attribute that
	// matters; missing it makes an entire run test nothing.
	const clearModals = () => ev(`(() => {
		document.querySelectorAll('[role="dialog"],[data-slot="dialog-overlay"],[data-dialog-overlay]').forEach(e => e.remove());
		document.body.style.pointerEvents = ''; document.body.removeAttribute('data-scroll-locked');
		return document.querySelectorAll('[data-slot="dialog-overlay"]').length;
	})()`);

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
	const key = async (k, code, vk, modifiers = 0, text) => {
		await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers });
		if (text) await send('Input.dispatchKeyEvent', { type: 'char', text, unmodifiedText: text, key: k, modifiers });
		await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers });
		await sleep(120);
	};
	const typeText = async (s) => { for (const ch of s) await key(ch, undefined, ch.charCodeAt(0), 0, ch); };

	/** The whole LaTeX document, not just the rendered lines. CodeMirror only
	 *  paints the viewport, so `.cm-content.innerText` silently truncates and any
	 *  assertion against it passes for the wrong reason. `cmTile` is internal
	 *  (`cmView` before CM 6.43); fall back to the visible text if it moves again. */
	const editorDoc = () =>
		ev(`(() => {
			const c = document.querySelector('.cm-content');
			if (!c) return null;
			const view = c.cmTile?.view ?? c.cmView?.view;
			return view ? view.state.doc.toString() : c.innerText;
		})()`);

	const focusInfo = () => ev(`(() => {
		const a = document.activeElement;
		return { tag: a?.tagName.toLowerCase(), isContent: !!a?.classList?.contains('cm-content'),
		         label: (a?.getAttribute('aria-label') || a?.placeholder || '').slice(0, 30) };
	})()`);

	// Click the first line, not the pane centre, which a late overlay can cover.
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

	/** Open or create a project and land in the LaTeX view. The doc mode is
	 *  persisted, so a previous run can leave the page in Visual with no editor. */
	const openProject = async () => {
		await send('Runtime.enable');
		await send('Page.enable');
		await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
		await send('Page.navigate', { url: PAGE });

		let route = '';
		for (let attempt = 0; attempt < 6 && !route.includes('/projects/'); attempt++) {
			await sleep(5000);
			await ev(`(() => { const l = document.querySelector('a[href*="/workspace/projects/"]'); if (l) { l.click(); return 1; }
			  [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||x.textContent||'').trim()==='New project')?.click(); return 2; })()`);
			for (let i = 0; i < 20; i++) {
				await sleep(500);
				if (await ev(`!!document.querySelector('.cm-content') || !!document.querySelector('[aria-label="Visual editor"]')`)) break;
			}
			route = (await ev(`location.pathname`)) || '';
		}
		await sleep(1200);
		await clearModals();
		await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^latex$/i.test((x.textContent||'').trim())); b?.click(); return !!b; })()`);
		for (let i = 0; i < 20; i++) {
			await sleep(400);
			if (await ev(`!!document.querySelector('.cm-content')`)) break;
		}
		await clearModals();
		return route;
	};

	const finish = () => {
		ws.close();
		const failed = results.filter((r) => !r.pass).length;
		console.log(`\n${results.length - failed}/${results.length} checks passed`);
		process.exit(failed ? 1 : 0);
	};

	return { send, ev, check, clearModals, clickAt, clickSel, key, typeText, editorDoc, focusInfo, focusDoc, openProject, finish };
}
