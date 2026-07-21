import type { Diagnostic, PackDefinition } from '@glyphx/tex-engine';
import { loadManifest, openEngineCache } from './tex/manifest';
import type { CompileFile, UnsentRequest, WorkerRequest, WorkerResponse } from './tex/protocol';

export type { CompileFile };

export type CompileOutcome = {
	/** The PDF, base64-encoded for the preview pane. */
	pdf?: string;
	log?: string;
	error?: string;
	/** Diagnostics parsed by the engine itself, rather than scraped from the log. */
	diagnostics?: Diagnostic[];
	/** Package sets that would supply what this compile could not find. */
	missingPacks?: PackDefinition[];
	/** Missing files no package set provides — an install would not help. */
	unsupportedFiles?: string[];
};

/** Bytes downloaded so far during the first-run install. */
export type InstallProgress = { loaded: number; total: number; label: string };

let worker: Worker | null = null;
let nextId = 1;

/** In-flight requests, keyed by message id. */
const pending = new Map<
	number,
	{
		resolve: (r: WorkerResponse) => void;
		reject: (e: Error) => void;
		onProgress?: (p: InstallProgress) => void;
	}
>();

// Off the main thread: a compile is synchronous and takes ~a second.
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

	// A worker-level error answers nothing, so reject every in-flight request.
	worker.onerror = (event) => {
		const error = new Error(event.message || 'The LaTeX engine worker stopped unexpectedly.');
		for (const [id, entry] of pending) {
			pending.delete(id);
			entry.reject(error);
		}
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

/**
 * Whether the engine is already downloaded on this device.
 * Asks the cache directly, so clearing site data brings the setup prompt back.
 */
export async function engineReady(): Promise<boolean> {
	try {
		const cache = await openEngineCache();
		if (!cache) return false;

		const manifest = await loadManifest();
		const wanted = Object.keys(manifest.files).map(
			(name) => `/engine/${name}?v=${manifest.version}`
		);
		const found = await Promise.all(wanted.map((url) => cache.match(url)));
		return found.every(Boolean);
	} catch {
		return false;
	}
}

/**
 * First-run install: download and cache the engine and TeX bundle, then boot it.
 * Throws with a user-facing message if the download fails.
 */
export async function installEngine(onProgress?: (p: InstallProgress) => void): Promise<void> {
	if (typeof window === 'undefined') throw new Error('Install runs in the browser.');
	await send({ type: 'install' }, onProgress);
}

/**
 * Boot the engine ahead of the first compile. Safe to call repeatedly.
 * Errors are swallowed; a real compile surfaces them properly.
 */
export function warmEngine(): void {
	if (typeof window === 'undefined') return;
	void send({ type: 'install' }).catch(() => {
		/* a real compile will report the failure */
	});
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

/** Single-file compile; the multi-file path with one `main.tex` mounted. */
export function compileLatex(source: string): Promise<CompileOutcome> {
	return compileFiles([{ name: 'main.tex', text: source }], 'main.tex');
}

/**
 * Compile `entry` with every file mounted, so `\input` and `\includegraphics`
 * resolve. Binary members carry `data`; text members carry `text`.
 */
export async function compileFiles(files: CompileFile[], entry: string): Promise<CompileOutcome> {
	if (typeof window === 'undefined') {
		return { error: 'Compilation runs in the browser.' };
	}
	if (!files.some((f) => f.name === entry)) {
		return { error: `The main file "${entry}" is not part of this document.` };
	}

	let response: WorkerResponse;
	try {
		response = await send({ type: 'compile', files, entry });
	} catch (e) {
		// Plain-language message for the user; raw detail goes in the log (AGENTS.md rule #5).
		return {
			error: 'Could not start the LaTeX engine. Check your connection and reload.',
			log: e instanceof Error ? e.message : String(e)
		};
	}

	if (response.type !== 'compiled') {
		return { error: 'The LaTeX engine returned an unexpected response.' };
	}

	// Show any PDF TeX produced even on error — it recovers and still typesets.
	if (response.pdf && response.pdf.byteLength > 0) {
		return {
			pdf: bytesToBase64(response.pdf),
			log: response.log,
			diagnostics: response.diagnostics,
			missingPacks: response.missingPacks,
			unsupportedFiles: response.unsupportedFiles
		};
	}

	return {
		log: response.log,
		diagnostics: response.diagnostics,
		missingPacks: response.missingPacks,
		unsupportedFiles: response.unsupportedFiles,
		error:
			response.message ?? 'LaTeX compilation failed — no PDF was produced. See the Problems panel.'
	};
}

/**
 * Download and activate package sets, then report so the caller can recompile.
 * `packIds` must already include dependencies (expand via `resolveMissing`).
 */
export async function installPacks(
	packIds: string[],
	onProgress?: (p: InstallProgress) => void
): Promise<void> {
	if (typeof window === 'undefined') throw new Error('Package sets install in the browser.');
	await send({ type: 'installPacks', packIds }, onProgress);
}
