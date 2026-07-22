/// <reference lib="webworker" />

import {
	TexEngine,
	EnginePoisonedError,
	defaultPacks,
	resolveMissing,
	type PackDefinition,
	type PackIndex
} from '@glyphx/tex-engine';
import { untar, gunzip } from './tar';
import { loadManifest, openEngineCache } from './manifest';
import { fetchPack, installedPacks, loadPackIndex } from './packs';
import { emptyMount, mountDocument, shadowsBundle } from './mount';
import type { WorkerRequest, WorkerResponse } from './protocol';

const post = (message: WorkerResponse, transfer: Transferable[] = []) =>
	self.postMessage(message, transfer);

let engine: TexEngine | null = null;
let booting: Promise<TexEngine> | null = null;
/** Loaded during boot; null when this deployment ships no packs. */
let packIndex: PackIndex | null = null;

// The engine outlives any one document, and its filesystem is a single flat map
// shared by bundle and project files. Tracking who owns what is what keeps one
// document's sources — and its .aux — from being inherited by the next.
let bundleNames = new Set<string>();
let mounted = emptyMount();

function trackBundle(engine: TexEngine, files: Map<string, Uint8Array>): void {
	engine.addFiles(files);
	for (const name of files.keys()) bundleNames.add(name);
}

type Report = (loaded: number, total: number, label: string) => void;

/** Cache keys carry the manifest version, so a new engine misses the old key. */
async function fetchCached(
	url: string,
	version: string,
	total: number,
	report: Report
): Promise<Uint8Array> {
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

	// Under `Content-Encoding` the reader yields decoded bytes while both `total`
	// and Content-Length describe the encoded size; 0 means unknowable, not zero.
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

		// One running count across both files, so the bar never resets between
		// them; either one being transport-compressed makes the whole thing 0.
		let read = 0;
		let indeterminate = false;
		const relay =
			(offset: number) =>
			(loaded: number, expected: number, label: string): void => {
				if (expected === 0) indeterminate = true;
				read = offset + loaded;
				report(read, indeterminate ? 0 : total, label);
			};

		const wasm = await fetchCached(
			'/engine/tectonic_wasm.wasm',
			manifest.version,
			wasmBytes,
			relay(0)
		);
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
		bundleNames = new Set();
		trackBundle(started, files);

		// The engine filesystem is in-memory, so a rebuilt engine starts at core
		// only; re-fetching defaults here also reaches pre-packs installs.
		packIndex = await loadPackIndex().catch(() => null);
		if (packIndex) {
			const installed = await installedPacks(packIndex);
			const have = new Set(installed.map((p) => p.id));
			const wanted = [...defaultPacks(packIndex), ...packIndex.packs.filter((p) => have.has(p.id))];

			for (const pack of new Set(wanted)) {
				try {
					trackBundle(started, untar(await gunzip(await fetchPack(packIndex, pack.id))));
				} catch (error) {
					// One unreachable pack must not take down a working compiler; the
					// document fails as if it were absent, which the prompt then fixes.
					console.error(`[GlyphX] could not load pack "${pack.id}":`, error);
				}
			}
		}

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

// A crash inside the wasm module locks its session permanently, so the engine
// must be rebuilt rather than reused.
function discardEngine(): void {
	engine = null;
	booting = null;
	mounted = emptyMount();
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const request = event.data;

	try {
		switch (request.type) {
			case 'install': {
				await boot((loaded, total, label) =>
					post({ id: request.id, type: 'progress', loaded, total, label })
				);
				post({ id: request.id, type: 'installed' });
				break;
			}

			case 'compile': {
				let ready = await boot(() => {
					/* the install flow is where the download is surfaced */
				});

				const mount = (engine: TexEngine) => {
					mounted = mountDocument(engine, mounted, request.docId, request.files);
				};
				// jobname defaults to the entry's basename, so pdf()/log() follow it.
				const options = { entry: request.entry, synctex: true, maxPasses: 5 };

				// Rebuilding is the only way to unmount a project file that shadowed a
				// bundle one. Rare, and the bundle comes back from the cache.
				if (shadowsBundle(mounted, bundleNames, request.docId)) {
					discardEngine();
					ready = await boot(() => {});
				}

				let result;
				try {
					mount(ready);
					result = ready.compile(options);
				} catch (error) {
					if (!(error instanceof EnginePoisonedError)) throw error;
					// An earlier document may be the culprit, so this one gets a clean try.
					discardEngine();
					ready = await boot(() => {});
					mount(ready);
					result = ready.compile(options);
				}

				const log = ready.log() ?? '';
				const pdf = result.status === 'failed' ? undefined : ready.pdf();

				const output = pdf && pdf.byteLength > 0 ? pdf : undefined;

				// Turn "File `fancyhdr.sty' not found" into a named, installable
				// package set. Resolved here because the index lives in the worker.
				const resolution =
					packIndex && result.missingFiles.length > 0
						? resolveMissing(packIndex, result.missingFiles, await installedPacks(packIndex))
						: null;

				post(
					{
						id: request.id,
						type: 'compiled',
						pdf: output,
						log,
						diagnostics: result.diagnostics,
						status: result.status,
						message: result.message ?? undefined,
						missingPacks: resolution?.packs,
						unsupportedFiles: resolution?.unsupported
					},
					// Transfer, not copy: the PDF is megabytes and nothing here rereads it.
					output ? [output.buffer as ArrayBuffer] : []
				);
				break;
			}

			case 'installPacks': {
				// Boot first: the packs have to go into a live engine, and booting
				// here means "install a pack" works before the first compile.
				const ready = await boot((loaded, total, label) =>
					post({ id: request.id, type: 'progress', loaded, total, label })
				);
				if (!packIndex) throw new Error('No package sets are available in this deployment.');

				for (const id of request.packIds) {
					const pack = packIndex.packs.find((p: PackDefinition) => p.id === id);
					post({
						id: request.id,
						type: 'progress',
						loaded: 0,
						total: 0,
						label: `Adding ${pack?.label ?? id}…`
					});
					trackBundle(ready, untar(await gunzip(await fetchPack(packIndex, id))));
				}

				post({ id: request.id, type: 'packsInstalled' });
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
