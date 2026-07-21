/// <reference lib="webworker" />
//
// The GlyphX TeX engine, off the main thread.
//
// `TexEngine.compile()` is synchronous and runs for the better part of a
// second, so on the main thread it would freeze the editor for the whole
// compile. It lives here instead, and the page talks to it by message.
//
// The worker owns the engine for the life of the tab: the ~500-file support
// bundle is loaded into the engine's virtual filesystem once, and every
// subsequent compile reuses it. Auxiliary files from the previous run are
// deliberately kept, because that is what lets the engine converge in fewer
// passes when the user recompiles a document they just edited.

import { TexEngine } from '@glyphx/tex-engine';
import { untar, gunzip } from './tar';
import { loadManifest, ENGINE_CACHE as CACHE } from './manifest';
import type { WorkerRequest, WorkerResponse } from './protocol';

const post = (message: WorkerResponse, transfer: Transferable[] = []) =>
	self.postMessage(message, transfer);

let engine: TexEngine | null = null;
let booting: Promise<TexEngine> | null = null;

/** Progress callback shape used while assembling the engine. */
type Report = (loaded: number, total: number, label: string) => void;

/**
 * Fetch a URL, serving it from the persistent cache when it is already there.
 *
 * Cache entries are keyed by the manifest version, so publishing a new engine
 * simply misses the old key rather than reusing a stale binary. Older versions
 * are evicted on a successful boot.
 */
async function fetchCached(url: string, version: string, total: number, report: Report): Promise<Uint8Array> {
	const key = `${url}?v=${version}`;
	const cache = typeof caches !== 'undefined' ? await caches.open(CACHE) : null;

	const cached = await cache?.match(key);
	if (cached) {
		report(total, total, 'Loading the compiler…');
		return new Uint8Array(await cached.arrayBuffer());
	}

	const response = await fetch(key);
	if (!response.ok) {
		throw new Error(`Could not download the compiler (${response.status} ${response.statusText}).`);
	}

	// Read the body incrementally so the dialog can show real progress on what
	// is a ~15 MB download, rather than sitting at zero and then jumping.
	const body = response.body;
	if (!body) return new Uint8Array(await response.arrayBuffer());

	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let loaded = 0;

	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		loaded += value.byteLength;
		report(loaded, total, 'Downloading the compiler…');
	}

	const bytes = new Uint8Array(loaded);
	let at = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, at);
		at += chunk.byteLength;
	}

	// Cache the assembled bytes rather than the original response: the response
	// stream is spent, and this keeps the cached entry independent of any
	// content-encoding the network applied.
	await cache?.put(key, new Response(bytes));

	return bytes;
}

/** Remove downloads belonging to superseded engine versions. */
async function evictOldVersions(version: string): Promise<void> {
	if (typeof caches === 'undefined') return;
	const cache = await caches.open(CACHE);
	for (const request of await cache.keys()) {
		// The manifest is unversioned by design — it is what tells an offline
		// client which version it has, so it must survive eviction.
		if (request.url.endsWith('/engine/manifest.json')) continue;
		if (!request.url.includes(`v=${version}`)) await cache.delete(request);
	}
}

/**
 * Download, cache and boot the engine.
 *
 * Concurrent callers share one attempt; a failed attempt is discarded so the
 * next call retries cleanly rather than resolving to a broken engine.
 */
function boot(report: Report): Promise<TexEngine> {
	if (engine) return Promise.resolve(engine);

	booting ??= (async () => {
		const manifest = await loadManifest();

		const wasmBytes = manifest.files['tectonic_wasm.wasm'].bytes;
		const bundleBytes = manifest.files['tectonic-bundle.tar.gz'].bytes;
		const total = wasmBytes + bundleBytes;

		// Both files report progress against the combined total, so the bar
		// advances once across the whole download instead of resetting.
		const wasm = await fetchCached('/engine/tectonic_wasm.wasm', manifest.version, wasmBytes, (loaded, _t, label) =>
			report(loaded, total, label)
		);
		const archive = await fetchCached(
			'/engine/tectonic-bundle.tar.gz',
			manifest.version,
			bundleBytes,
			(loaded, _t, label) => report(wasmBytes + loaded, total, label)
		);

		report(total, total, 'Unpacking TeX packages…');
		const files = untar(await gunzip(archive));

		report(total, total, 'Starting the compiler…');
		const started = await TexEngine.load(wasm);
		started.addFiles(files);

		await evictOldVersions(manifest.version).catch(() => {
			/* eviction is housekeeping — never fail a working boot over it */
		});

		engine = started;
		return started;
	})();

	return booting.catch((error) => {
		booting = null;
		throw error;
	});
}

/** Turn anything thrown into a message worth showing a user. */
function messageOf(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const request = event.data;

	try {
		switch (request.type) {
			case 'install': {
				await boot((loaded, total, label) => post({ id: request.id, type: 'progress', loaded, total, label }));
				post({ id: request.id, type: 'installed' });
				break;
			}

			case 'compile': {
				const ready = await boot(() => {
					/* a compile that has to boot reports no progress — the install
					   flow is where the download is surfaced */
				});

				ready.addFile('main.tex', request.source);

				const result = ready.compile({
					entry: 'main.tex',
					synctex: true,
					// The engine reruns internally until the log stops asking, so
					// there is no multi-pass loop on this side.
					maxPasses: 5
				});

				const log = ready.log() ?? '';
				const pdf = result.status === 'failed' ? undefined : ready.pdf();

				const output = pdf && pdf.byteLength > 0 ? pdf : undefined;

				post(
					{
						id: request.id,
						type: 'compiled',
						pdf: output,
						log,
						diagnostics: result.diagnostics,
						status: result.status,
						message: result.message ?? undefined
					},
					// Transfer rather than copy: the PDF is megabytes, and `pdf()`
					// already returned a fresh buffer that nothing here reads again.
					output ? [output.buffer as ArrayBuffer] : []
				);
				break;
			}
		}
	} catch (error) {
		post({ id: request.id, type: 'error', message: messageOf(error) });
	}
};
