/// <reference lib="webworker" />

import { TexEngine, EnginePoisonedError } from '@glyphx/tex-engine';
import { untar, gunzip } from './tar';
import { loadManifest, openEngineCache } from './manifest';
import type { WorkerRequest, WorkerResponse } from './protocol';

const post = (message: WorkerResponse, transfer: Transferable[] = []) =>
	self.postMessage(message, transfer);

let engine: TexEngine | null = null;
let booting: Promise<TexEngine> | null = null;

type Report = (loaded: number, total: number, label: string) => void;

/** Cache keys carry the manifest version, so a new engine misses the old key. */
async function fetchCached(url: string, version: string, total: number, report: Report): Promise<Uint8Array> {
	const key = `${url}?v=${version}`;
	const cache = await openEngineCache();

	const cached = await cache?.match(key);
	if (cached) {
		report(total, total, 'Loading the compiler…');
		return new Uint8Array(await cached.arrayBuffer());
	}

	// Name the file in any failure — "Failed to fetch" alone is untraceable
	// once there are several assets.
	const name = url.split('/').pop() ?? url;
	let response: Response;
	try {
		response = await fetch(key);
	} catch (cause) {
		throw new Error(
			`Could not download ${name}: ${cause instanceof Error ? cause.message : String(cause)}`,
			{ cause }
		);
	}
	if (!response.ok) {
		throw new Error(`Could not download ${name} (${response.status} ${response.statusText}).`);
	}

	// How many bytes we will actually read.
	//
	// Not `total` (the manifest's on-disk size) and not always Content-Length:
	// when the transport applies its own compression the reader yields DECODED
	// bytes while both of those describe the ENCODED size. Our bundle is a
	// `.tar.gz`, and servers routinely serve that with `Content-Encoding: gzip`,
	// so the stream can be 4x the declared figure — a percentage against it hits
	// 100% almost immediately and looks like nothing downloaded at all.
	//
	// The decoded size is genuinely unknowable up front in that case, so we say
	// so with 0 rather than showing a number we know to be wrong.
	const encoded = response.headers.get('content-encoding');
	const declared = Number(response.headers.get('content-length'));
	const expected = encoded ? 0 : Number.isFinite(declared) && declared > 0 ? declared : total;

	// Read incrementally so the dialog can show progress on a large download.
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
		report(loaded, expected, 'Downloading the compiler…');
	}

	const bytes = new Uint8Array(loaded);
	let at = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, at);
		at += chunk.byteLength;
	}

	// Cache the assembled bytes, not the response — its stream is already spent.
	// Best-effort: a quota rejection must not discard a download that succeeded.
	await cache?.put(key, new Response(bytes)).catch(() => {});

	return bytes;
}

async function evictOldVersions(version: string): Promise<void> {
	const cache = await openEngineCache();
	if (!cache) return;
	for (const request of await cache.keys()) {
		// Unversioned by design: it tells an offline client which version it has.
		if (request.url.endsWith('/engine/manifest.json')) continue;
		if (!request.url.includes(`v=${version}`)) await cache.delete(request);
	}
}

/** Concurrent callers share one attempt; a failed attempt is discarded. */
function boot(report: Report): Promise<TexEngine> {
	if (engine) return Promise.resolve(engine);

	booting ??= (async () => {
		const manifest = await loadManifest();

		const wasmBytes = manifest.files['tectonic_wasm.wasm'].bytes;
		const bundleBytes = manifest.files['tectonic-bundle.tar.gz'].bytes;
		const total = wasmBytes + bundleBytes;

		// Both files report against one running count, so the bar never resets
		// between them. If either turns out to be transport-compressed its decoded
		// size is unknown, and the whole download becomes indeterminate — a total
		// of 0 — rather than being measured against a figure we know is wrong.
		let read = 0;
		let indeterminate = false;
		const relay =
			(offset: number) =>
			(loaded: number, expected: number, label: string): void => {
				if (expected === 0) indeterminate = true;
				read = offset + loaded;
				report(read, indeterminate ? 0 : total, label);
			};

		const wasm = await fetchCached('/engine/tectonic_wasm.wasm', manifest.version, wasmBytes, relay(0));
		const archive = await fetchCached(
			'/engine/tectonic-bundle.tar.gz',
			manifest.version,
			bundleBytes,
			relay(read)
		);

		// Past this point there is nothing left to measure, so the numbers hold
		// still and only the label moves.
		const settled = indeterminate ? 0 : total;
		report(read, settled, 'Unpacking TeX packages…');
		const files = untar(await gunzip(archive));

		report(read, settled, 'Starting the compiler…');
		const started = await TexEngine.load(wasm);
		started.addFiles(files);

		await evictOldVersions(manifest.version).catch(() => {
			/* housekeeping — never fail a working boot over it */
		});

		engine = started;
		return started;
	})();

	return booting.catch((error) => {
		booting = null;
		throw error;
	});
}

function messageOf(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

/**
 * A crash inside the wasm module locks its session permanently — every later
 * call repeats the error, so the engine must be rebuilt rather than reused.
 */
function discardEngine(): void {
	engine = null;
	booting = null;
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
				let ready = await boot(() => {
					/* the install flow is where the download is surfaced */
				});

				let result;
				try {
					ready.addFile('main.tex', request.source);
					result = ready.compile({
						entry: 'main.tex',
						synctex: true,
						// The engine reruns internally until the log stops asking.
						maxPasses: 5
					});
				} catch (error) {
					if (!(error instanceof EnginePoisonedError)) throw error;
					// An earlier document may be the culprit, so this one gets a clean try.
					discardEngine();
					ready = await boot(() => {});
					ready.addFile('main.tex', request.source);
					result = ready.compile({ entry: 'main.tex', synctex: true, maxPasses: 5 });
				}

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
					// Transfer, not copy: the PDF is megabytes and nothing here rereads it.
					output ? [output.buffer as ArrayBuffer] : []
				);
				break;
			}
		}
	} catch (error) {
		// The retry was poisoned too. Discard anyway — a dead engine fails every
		// later compile, including ones that would succeed.
		if (error instanceof EnginePoisonedError) discardEngine();
		// The message that crosses back is written for a user; the stack only
		// exists here, so log it before it is lost (AGENTS.md rule #5).
		console.error('[GlyphX] engine worker failed:', error);
		post({ id: request.id, type: 'error', message: messageOf(error) });
	}
};
