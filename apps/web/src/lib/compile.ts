// Browser LaTeX compilation on the in-house GlyphX engine.
//
// The engine is Tectonic (XeTeX + xdvipdfmx) compiled to WebAssembly — the same
// engine the desktop app runs — wrapped by `@glyphx/tex-engine`. It runs in a
// Web Worker (see `tex/worker.ts`) because a compile is synchronous and takes
// the better part of a second.
//
// Everything is same-origin and self-contained: the wasm binary and the TeX
// support bundle are served from `/engine/`, downloaded once, and kept in the
// persistent Cache API. After the first run there is no network in the compile
// path at all, so compiling works offline and cannot be broken by a third-party
// package server going down.

import type { Diagnostic } from '@glyphx/tex-engine';
import { loadManifest, ENGINE_CACHE } from './tex/manifest';
import type { UnsentRequest, WorkerRequest, WorkerResponse } from './tex/protocol';

export type CompileOutcome = {
	/** The PDF, base64-encoded for the preview pane. */
	pdf?: string;
	log?: string;
	error?: string;
	/** Diagnostics parsed by the engine itself, rather than scraped from the log. */
	diagnostics?: Diagnostic[];
};

/** Bytes downloaded so far during the first-run install. */
export type InstallProgress = { loaded: number; total: number; label: string };

/* ------------------------------------------------------------------ worker */

let worker: Worker | null = null;
let nextId = 1;

/** In-flight requests, keyed by message id. */
const pending = new Map<
	number,
	{ resolve: (r: WorkerResponse) => void; reject: (e: Error) => void; onProgress?: (p: InstallProgress) => void }
>();

function getWorker(): Worker {
	if (worker) return worker;

	worker = new Worker(new URL('./tex/worker.ts', import.meta.url), { type: 'module' });

	worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
		const response = event.data;
		const entry = pending.get(response.id);
		if (!entry) return;

		if (response.type === 'progress') {
			entry.onProgress?.({ loaded: response.loaded, total: response.total, label: response.label });
			return; // more messages to come for this id
		}

		pending.delete(response.id);
		if (response.type === 'error') entry.reject(new Error(response.message));
		else entry.resolve(response);
	};

	// A worker-level error leaves every in-flight request unanswered, so fail
	// them all rather than letting their promises hang forever.
	worker.onerror = (event) => {
		const error = new Error(event.message || 'The LaTeX engine worker stopped unexpectedly.');
		for (const [id, entry] of pending) {
			pending.delete(id);
			entry.reject(error);
		}
		// Drop the dead worker so the next call starts a fresh one.
		worker?.terminate();
		worker = null;
	};

	return worker;
}

function send(
	request: UnsentRequest,
	onProgress?: (p: InstallProgress) => void
): Promise<WorkerResponse> {
	const id = nextId++;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject, onProgress });
		getWorker().postMessage({ ...request, id } as WorkerRequest);
	});
}

/* ----------------------------------------------------------------- install */

/**
 * Whether the engine is already downloaded on this device.
 *
 * This asks the cache directly rather than trusting a "user clicked install"
 * flag, so clearing site data correctly brings the setup prompt back instead of
 * leaving the app claiming an engine it no longer has.
 */
export async function engineReady(): Promise<boolean> {
	if (typeof caches === 'undefined') return false;

	try {
		const manifest = await loadManifest();
		const cache = await caches.open(ENGINE_CACHE);
		const wanted = Object.keys(manifest.files).map((name) => `/engine/${name}?v=${manifest.version}`);
		const found = await Promise.all(wanted.map((url) => cache.match(url)));
		return found.every(Boolean);
	} catch {
		return false;
	}
}

/**
 * First-run install: download the engine and the TeX bundle, cache them, and
 * boot the engine so the first real compile has nothing left to do.
 *
 * Throws with a user-facing message if the download fails, so the dialog can
 * show it and offer a retry.
 */
export async function installEngine(onProgress?: (p: InstallProgress) => void): Promise<void> {
	if (typeof window === 'undefined') throw new Error('Install runs in the browser.');
	await send({ type: 'install' }, onProgress);
}

/**
 * Boot the engine ahead of the first compile, so pressing "Compile" on an
 * already-installed device feels instant. Safe to call repeatedly — the worker
 * keeps one engine — and errors are swallowed because a real compile will
 * surface them properly.
 */
export function warmEngine(): void {
	if (typeof window === 'undefined') return;
	void send({ type: 'install' }).catch(() => {
		/* a real compile will report the failure */
	});
}

/* ----------------------------------------------------------------- compile */

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

	let response: WorkerResponse;
	try {
		response = await send({ type: 'compile', source });
	} catch (e) {
		// Plain-language message for the user; raw detail goes in the log
		// (AGENTS.md rule #5).
		return {
			error: 'Could not start the LaTeX engine. Check your connection and reload.',
			log: e instanceof Error ? e.message : String(e)
		};
	}

	if (response.type !== 'compiled') {
		return { error: 'The LaTeX engine returned an unexpected response.' };
	}

	// Best-effort, matching the desktop engines: if TeX produced a PDF, show it
	// even when the run reported errors. TeX recovers from most problems and
	// still typesets; the errors surface in the Problems panel.
	if (response.pdf && response.pdf.byteLength > 0) {
		return { pdf: bytesToBase64(response.pdf), log: response.log, diagnostics: response.diagnostics };
	}

	return {
		log: response.log,
		diagnostics: response.diagnostics,
		error:
			response.message ??
			'LaTeX compilation failed — no PDF was produced. See the Problems panel.'
	};
}
