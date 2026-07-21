/**
 * Typed wrapper around the GlyphX TeX engine WebAssembly module.
 *
 * The boundary is deliberately split: options and results cross as JSON (small,
 * once per compile, and typed by declarations generated from the Rust
 * definitions), while file bytes move through linear memory directly.
 */

import { createImports, ExitStatus, type EngineIo } from './imports.js';
import type { CompileOptions, CompileResult } from './generated/index.js';

/** ABI version this wrapper is written against. */
export const SUPPORTED_ABI_VERSION = 1;

/**
 * Options accepted by {@link TexEngine.compile}.
 *
 * Every field is optional: the Rust side applies `serde` defaults to whatever is
 * omitted, so `{}` is a valid request.
 */
export type CompileRequest = Partial<CompileOptions>;

/** Anything the module can be instantiated from. */
export type WasmSource =
	| BufferSource
	| WebAssembly.Module
	| Response
	| Promise<Response>;

interface EngineExports {
	memory: WebAssembly.Memory;
	__indirect_function_table: WebAssembly.Table;
	setThrew(threw: number, value: number): void;
	_start?(): void;
	glyphx_abi_version(): number;
	glyphx_alloc(len: number): number;
	glyphx_dealloc(ptr: number, len: number): void;
	glyphx_add_file(
		namePtr: number,
		nameLen: number,
		dataPtr: number,
		dataLen: number
	): number;
	glyphx_remove_file(namePtr: number, nameLen: number): number;
	glyphx_file_count(): number;
	glyphx_clear_files(): void;
	glyphx_clear_outputs(): void;
	glyphx_compile(optionsPtr: number, optionsLen: number): number;
	glyphx_result_ptr(): number;
	glyphx_result_len(): number;
	glyphx_output_len(namePtr: number, nameLen: number): number;
	glyphx_output_copy(buf: number, bufLen: number): number;
}

/** Raised when the module rejects an argument outright. */
export class EngineError extends Error {
	constructor(
		message: string,
		readonly code?: number
	) {
		super(message);
		this.name = 'EngineError';
	}
}

const ERROR_CODES: Record<number, string> = {
	[-1]: 'invalid pointer or length',
	[-2]: 'argument was not valid UTF-8',
	[-3]: 'options JSON could not be parsed'
};

export class TexEngine {
	readonly #exports: EngineExports;
	readonly #encoder = new TextEncoder();
	readonly #decoder = new TextDecoder();

	private constructor(exports: EngineExports) {
		this.#exports = exports;
	}

	/**
	 * Instantiate the engine.
	 *
	 * Prefer passing a `Response` (or a promise of one) in the browser so the
	 * module compiles while it downloads — that streaming path is also the only
	 * one V8 will populate its compiled-code cache from.
	 */
	static async load(source: WasmSource, io: EngineIo = {}): Promise<TexEngine> {
		const { imports, bind } = createImports(io);

		// Bytes are compiled to a Module first rather than handed straight to
		// `WebAssembly.instantiate`. That call is overloaded — bytes resolve to
		// `{ module, instance }`, a Module resolves to an Instance — and since
		// `WebAssembly.Module` is declared as an empty interface, a BufferSource
		// matches it structurally and TypeScript binds the wrong signature. The
		// separate `compile` step is unambiguous and behaves identically.
		let instance: WebAssembly.Instance;
		if (isResponseLike(source)) {
			const result = await WebAssembly.instantiateStreaming(source, imports);
			instance = result.instance;
		} else {
			const module =
				source instanceof WebAssembly.Module ? source : await WebAssembly.compile(source);
			instance = await WebAssembly.instantiate(module, imports);
		}

		const exports = instance.exports as unknown as EngineExports;
		bind(exports);

		// libc initialisation. It calls proc_exit on completion, which surfaces
		// as ExitStatus; that is expected rather than a failure.
		try {
			exports._start?.();
		} catch (e) {
			if (!(e instanceof ExitStatus)) throw e;
		}

		const abi = exports.glyphx_abi_version();
		if (abi !== SUPPORTED_ABI_VERSION) {
			throw new EngineError(
				`engine ABI ${abi} is not supported by this wrapper (expected ${SUPPORTED_ABI_VERSION})`
			);
		}

		return new TexEngine(exports);
	}

	/** How many files are currently in the virtual filesystem. */
	get fileCount(): number {
		return this.#exports.glyphx_file_count();
	}

	/** Add or replace a file. Accepts a string (encoded UTF-8) or raw bytes. */
	addFile(name: string, data: Uint8Array | string): void {
		const bytes = typeof data === 'string' ? this.#encoder.encode(data) : data;
		const namePtr = this.#write(this.#encoder.encode(name));
		const dataPtr = this.#write(bytes);
		try {
			const rc = this.#exports.glyphx_add_file(
				namePtr.ptr,
				namePtr.len,
				dataPtr.ptr,
				dataPtr.len
			);
			if (rc !== 0) throw this.#error(`could not add "${name}"`, rc);
		} finally {
			this.#release(namePtr);
			this.#release(dataPtr);
		}
	}

	/** Add many files at once — typically a bundle. */
	addFiles(files: Record<string, Uint8Array | string> | Iterable<[string, Uint8Array | string]>): void {
		const entries = Symbol.iterator in files ? files : Object.entries(files);
		for (const [name, data] of entries as Iterable<[string, Uint8Array | string]>) {
			this.addFile(name, data);
		}
	}

	/** Remove a file. Returns whether it was present. */
	removeFile(name: string): boolean {
		const n = this.#write(this.#encoder.encode(name));
		try {
			const rc = this.#exports.glyphx_remove_file(n.ptr, n.len);
			if (rc < 0) throw this.#error(`could not remove "${name}"`, rc);
			return rc === 1;
		} finally {
			this.#release(n);
		}
	}

	/** Drop every input file. */
	clearFiles(): void {
		this.#exports.glyphx_clear_files();
	}

	/** Discard the previous compile's auxiliary files, forcing a cold build. */
	clearOutputs(): void {
		this.#exports.glyphx_clear_outputs();
	}

	/**
	 * Compile a document.
	 *
	 * Resolves for any completed run — including one that failed to produce a
	 * PDF. Check `result.status`: `failed` is the only value meaning no output
	 * exists, because TeX recovers from most errors and still typesets.
	 */
	compile(request: CompileRequest = {}): CompileResult {
		const payload = this.#encoder.encode(JSON.stringify(request));
		const opts = this.#write(payload);
		try {
			const rc = this.#exports.glyphx_compile(opts.ptr, opts.len);
			const result = this.#readResult();
			// A negative code means the request itself was unusable; the result
			// still carries the explanation, so prefer its message.
			if (rc < 0 && result.status !== 'failed') {
				throw this.#error('compile request rejected', rc);
			}
			return result;
		} finally {
			this.#release(opts);
		}
	}

	/** Fetch the bytes of a file produced by the last compile. */
	output(name: string): Uint8Array | undefined {
		const n = this.#write(this.#encoder.encode(name));
		try {
			const size = this.#exports.glyphx_output_len(n.ptr, n.len);
			if (size < 0) return undefined;
			if (size === 0) return new Uint8Array(0);

			const buf = this.#exports.glyphx_alloc(size);
			if (buf === 0) throw new EngineError(`could not allocate ${size} bytes for "${name}"`);
			try {
				const written = this.#exports.glyphx_output_copy(buf, size);
				if (written < 0) throw new EngineError(`could not read "${name}"`);
				// Copy out of linear memory before returning: the buffer is
				// about to be freed, and memory growth can detach the view.
				return new Uint8Array(this.#exports.memory.buffer, buf, written).slice();
			} finally {
				this.#exports.glyphx_dealloc(buf, size);
			}
		} finally {
			this.#release(n);
		}
	}

	/** Convenience: the compiled PDF, if the last compile produced one. */
	pdf(jobname = 'main'): Uint8Array | undefined {
		return this.output(`${jobname}.pdf`);
	}

	/** Convenience: the TeX log from the last compile, decoded as text. */
	log(jobname = 'main'): string | undefined {
		const bytes = this.output(`${jobname}.log`);
		return bytes && this.#decoder.decode(bytes);
	}

	#readResult(): CompileResult {
		const ptr = this.#exports.glyphx_result_ptr();
		const len = this.#exports.glyphx_result_len();
		if (len === 0) {
			throw new EngineError('engine returned an empty result');
		}
		// Build the view after the call — a growing memory detaches older ones.
		const json = this.#decoder.decode(
			new Uint8Array(this.#exports.memory.buffer, ptr, len)
		);
		return JSON.parse(json) as CompileResult;
	}

	#write(bytes: Uint8Array): { ptr: number; len: number } {
		if (bytes.length === 0) return { ptr: 0, len: 0 };
		const ptr = this.#exports.glyphx_alloc(bytes.length);
		if (ptr === 0) {
			throw new EngineError(`could not allocate ${bytes.length} bytes`);
		}
		new Uint8Array(this.#exports.memory.buffer, ptr, bytes.length).set(bytes);
		return { ptr, len: bytes.length };
	}

	#release({ ptr, len }: { ptr: number; len: number }): void {
		if (ptr !== 0) this.#exports.glyphx_dealloc(ptr, len);
	}

	#error(context: string, code: number): EngineError {
		const detail = ERROR_CODES[code] ?? `error ${code}`;
		return new EngineError(`${context}: ${detail}`, code);
	}
}

function isResponseLike(source: WasmSource): source is Response | Promise<Response> {
	return (
		source instanceof Response ||
		(typeof source === 'object' && source !== null && 'then' in source)
	);
}
