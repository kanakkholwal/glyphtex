// Browser LaTeX compilation via the SwiftLaTeX PdfTeX WASM engine
// (self-hosted in /static/swiftlatex). The engine runs in a Web Worker and
// fetches TeX packages on demand, so the first use of a package needs network;
// everything else is in-browser.
//
// The engine is pointed at our OWN same-origin endpoint `/texlive/` — a route
// on our Cloudflare deployment (see routes/texlive/[...path]/+server.ts) that
// serves a vendored format + proxies and edge-caches the upstream on-demand
// server. So the third-party server is a cached backend behind our domain, not
// a hard dependency: once a file is cached at our edge (or in the per-device
// service-worker cache) it keeps working even if upstream is down.

import { PACKAGE_GROUPS } from './engine-packages';

export type CompileOutcome = { pdf?: string; log?: string; error?: string };

// Whether the user has completed the first-run "Set up the compiler" download.
// This only gates the UI; the actual downloaded files live in the service
// worker's persistent `glyphx-texlive` cache. If that's cleared but the flag
// isn't, compiles simply re-fetch (and re-cache) on demand — no breakage.
const READY_KEY = 'glyphx:web-engine-ready';

export function engineReady(): boolean {
	try {
		return typeof localStorage !== 'undefined' && localStorage.getItem(READY_KEY) === '1';
	} catch {
		return false;
	}
}

export function markEngineReady(): void {
	try {
		localStorage.setItem(READY_KEY, '1');
	} catch {
		/* storage unavailable (private mode) — the install still works this session */
	}
}

export type InstallProgress = { done: number; total: number; label: string };

const ENGINE_SRC = '/swiftlatex/PdfTeXEngine.js';

/**
 * The slice of the self-hosted SwiftLaTeX pdfTeX engine we actually call. Upstream
 * ships no types, so this is our narrowed contract at the boundary (AGENTS.md rule
 * #7 — parse/narrow untrusted shapes, no blanket `any`).
 */
interface PdfTeXEngine {
	loadEngine(): Promise<void>;
	writeMemFSFile(name: string, content: string): void;
	setEngineMainFile(name: string): void;
	compileLaTeX(): Promise<{ pdf?: ArrayBuffer; log?: string }>;
	/** The underlying Web Worker; we post `settexliveurl` straight to it. */
	latexWorker?: { postMessage(message: unknown): void };
}
type PdfTeXEngineClass = new () => PdfTeXEngine;

/** Globals the classic engine script attaches to `window` once loaded. */
interface EngineWindow {
	exports?: { PdfTeXEngine?: PdfTeXEngineClass };
	__PdfTeXEngineClass?: PdfTeXEngineClass;
}

/**
 * Our own same-origin TeX endpoint. The engine fetches `<endpoint>pdftex/<n>/<file>`;
 * `routes/texlive/[...path]/+server.ts` serves it from a vendored copy, our edge
 * cache, then the upstream on-demand server (which it caches). Same-origin means
 * the per-device service worker also caches it persistently.
 */
function texliveEndpoint(): string {
	return typeof location !== 'undefined' ? new URL('/texlive/', location.origin).href : '/texlive/';
}

let enginePromise: Promise<PdfTeXEngine> | null = null;

/** Load PdfTeXEngine.js as a classic script; it exposes `window.exports.PdfTeXEngine`. */
function loadEngineClass(): Promise<PdfTeXEngineClass> {
	const w = window as unknown as EngineWindow;
	if (w.__PdfTeXEngineClass) return Promise.resolve(w.__PdfTeXEngineClass);

	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = ENGINE_SRC;
		script.async = true;
		script.onload = () => {
			const cls = (window as unknown as EngineWindow).exports?.PdfTeXEngine;
			if (cls) {
				w.__PdfTeXEngineClass = cls;
				resolve(cls);
			} else {
				reject(new Error('SwiftLaTeX engine loaded but PdfTeXEngine was not found.'));
			}
		};
		script.onerror = () => reject(new Error('Failed to load the SwiftLaTeX engine.'));
		document.head.appendChild(script);
	});
}

/** Lazily create + boot a single engine instance (one compile at a time). */
function getEngine(): Promise<PdfTeXEngine> {
	if (!enginePromise) {
		enginePromise = (async () => {
			const PdfTeXEngine = await loadEngineClass();
			const engine = new PdfTeXEngine();
			await engine.loadEngine();
			// Point the package/format server at our same-origin edge route.
			// Posted straight to the worker — the wrapper's setTexliveEndpoint()
			// detaches the worker reference (upstream bug), so we bypass it.
			engine.latexWorker?.postMessage({ cmd: 'settexliveurl', url: texliveEndpoint() });
			return engine;
		})().catch((e) => {
			enginePromise = null; // allow retry after a failed boot
			throw e;
		});
	}
	return enginePromise;
}

/**
 * Kick off loading + booting the WASM engine ahead of the first compile (~1.7 MB
 * download + worker spin-up), so the first "Compile" feels instant. Safe to call
 * repeatedly — it reuses the single cached engine and swallows boot errors (the
 * next real compile will surface them).
 */
export function warmEngine(): void {
	if (typeof window === 'undefined') return;
	void getEngine().catch(() => {
		/* a real compile will report the failure */
	});
}

/** Compile a tiny throwaway doc to pull the format + `preamble`'s packages into
 *  the service-worker cache. Returns whether a PDF came out — used to tell a
 *  real failure (engine/server unreachable → no PDF) from a clean warm-up. */
async function warmCompile(engine: PdfTeXEngine, preamble: string): Promise<boolean> {
	const src = `\\documentclass{article}\n${preamble}\n\\begin{document}.\\end{document}`;
	engine.writeMemFSFile('main.tex', src);
	engine.setEngineMainFile('main.tex');
	const result = await engine.compileLaTeX();
	return !!result?.pdf && new Uint8Array(result.pdf).byteLength > 0;
}

/**
 * First-run install: boot the engine, then warm the TeX format and the selected
 * common-package groups so they're cached (persistently, by the service worker)
 * before the user's first real compile. `groupIds` are `PACKAGE_GROUPS` ids;
 * pass `[]` to fetch just the engine + format. Reports coarse per-step progress.
 * Throws if the engine can't boot or the package server is unreachable, so the
 * dialog can surface the error and offer a retry.
 */
export async function installEngine(
	groupIds: string[],
	onProgress?: (p: InstallProgress) => void
): Promise<void> {
	if (typeof window === 'undefined') throw new Error('Install runs in the browser.');

	const groups = PACKAGE_GROUPS.filter((g) => groupIds.includes(g.id));
	// Steps: boot engine + warm format + one per selected group.
	const total = groups.length + 2;
	let done = 0;
	const tick = (label: string) => onProgress?.({ done: ++done, total, label });

	onProgress?.({ done, total, label: 'Starting the LaTeX engine…' });
	const engine = await getEngine();
	tick('LaTeX engine ready');

	// Format step is the hard gate: a missing PDF here means the engine or the
	// package server is unreachable, so don't claim "installed".
	onProgress?.({ done, total, label: 'Downloading TeX format & core files…' });
	const formatOk = await warmCompile(engine, '');
	if (!formatOk) {
		throw new Error("Couldn't reach the TeX package server to download the format file.");
	}
	tick('TeX format & core files');

	// Package groups are best-effort: an individual package that won't warm
	// shouldn't block the whole install — it'll be fetched on first real use.
	for (const g of groups) {
		onProgress?.({ done, total, label: `Downloading ${g.label} packages…` });
		try {
			await warmCompile(engine, g.packages.map((p) => `\\usepackage{${p}}`).join('\n'));
		} catch {
			/* keep going — the package streams + caches on demand later */
		}
		tick(`${g.label} packages`);
	}

	markEngineReady();
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

export async function compileLatex(source: string): Promise<CompileOutcome> {
	if (typeof window === 'undefined') {
		return { error: 'Compilation runs in the browser.' };
	}

	let engine: PdfTeXEngine;
	try {
		engine = await getEngine();
	} catch {
		return {
			error:
				'Could not start the in-browser LaTeX engine. Check your connection and reload — ' +
				'the engine (~2 MB) downloads on first use.'
		};
	}

	try {
		engine.writeMemFSFile('main.tex', source);
		engine.setEngineMainFile('main.tex');
		const result = await engine.compileLaTeX();
		const log: string = result?.log ?? '';
		const pdf: Uint8Array | undefined = result?.pdf ? new Uint8Array(result.pdf) : undefined;

		// Best-effort, like the desktop engines: if pdfTeX produced a PDF, show it
		// even when it exited non-zero (recoverable errors). The errors live in the
		// log and surface in the Problems panel.
		if (pdf && pdf.byteLength > 0) {
			return { pdf: bytesToBase64(pdf), log };
		}
		return {
			log,
			error: 'LaTeX compilation failed — no PDF was produced. See the Problems panel.'
		};
	} catch (e) {
		// Plain-language message for the user; raw detail lives in the log (AGENTS.md rule #5).
		return {
			error: 'The LaTeX engine crashed while compiling. Reload the page and try again.',
			log: String(e)
		};
	}
}
