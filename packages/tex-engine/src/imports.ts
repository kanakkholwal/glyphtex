/**
 * Host imports for the Emscripten-built Tectonic module.
 *
 * The module needs 24 imports: 11 from `wasi_snapshot_preview1` and 13 from
 * `env`. That is a small enough surface to implement by hand, which is why this
 * package ships no Emscripten JS glue — the generated glue is large, version-
 * coupled to the exact emcc build, and mostly provides a POSIX filesystem the
 * engine never uses (Tectonic routes all I/O through its own Rust `IoProvider`).
 */

/** Thrown by `proc_exit`; carries the process exit code. */
export class ExitStatus extends Error {
	constructor(readonly code: number) {
		super(`wasm exited with status ${code}`);
		this.name = 'ExitStatus';
	}
}

/** Thrown by the longjmp import and caught by the `invoke_*` trampolines. */
class LongjmpError extends Error {
	constructor() {
		super('longjmp');
		this.name = 'LongjmpError';
	}
}

/** Where the engine's own stderr/stdout should go. */
export interface EngineIo {
	/** Called with each chunk the engine writes to stderr. */
	onStderr?(text: string): void;
	/** Called with each chunk the engine writes to stdout. */
	onStdout?(text: string): void;
}

/** The exports this shim needs back from the instantiated module. */
interface ShimTarget {
	memory: WebAssembly.Memory;
	__indirect_function_table: WebAssembly.Table;
	setThrew(threw: number, value: number): void;
}

const WASI_ESUCCESS = 0;

/**
 * Build the import object.
 *
 * The instance is supplied lazily via the returned `bind` because the imports
 * must reference the module's memory and function table, which do not exist
 * until after instantiation — a circular dependency inherent to the ABI.
 */
export function createImports(io: EngineIo = {}): {
	imports: WebAssembly.Imports;
	bind(target: ShimTarget): void;
} {
	let target: ShimTarget | undefined;
	const decoder = new TextDecoder();

	const view = () => new DataView(must().memory.buffer);
	const bytes = () => new Uint8Array(must().memory.buffer);

	function must(): ShimTarget {
		if (!target) throw new Error('imports used before bind() — instantiate first');
		return target;
	}

	function fdWrite(fd: number, iovs: number, iovsLen: number, nwritten: number): number {
		const dv = view();
		const mem = bytes();
		let written = 0;
		for (let i = 0; i < iovsLen; i++) {
			const ptr = dv.getUint32(iovs + i * 8, true);
			const len = dv.getUint32(iovs + i * 8 + 4, true);
			if (len === 0) continue;
			const text = decoder.decode(mem.subarray(ptr, ptr + len));
			if (fd === 1) io.onStdout?.(text);
			else io.onStderr?.(text);
			written += len;
		}
		dv.setUint32(nwritten, written, true);
		return WASI_ESUCCESS;
	}

	/**
	 * Emscripten's setjmp/longjmp trampoline. A `longjmp` unwinds as a JS
	 * exception; catching it and calling `setThrew` is how the C side learns
	 * that its `setjmp` returned a second time.
	 */
	function invoke(index: number, ...args: number[]): number {
		try {
			return (must().__indirect_function_table.get(index) as (...a: number[]) => number)(
				...args
			);
		} catch (e) {
			if (e instanceof ExitStatus) throw e;
			if (!(e instanceof LongjmpError)) throw e;
			must().setThrew(1, 0);
			return 0;
		}
	}

	const wasi = {
		fd_write: fdWrite,
		// The engine reads files through its Rust IoProvider, never through a
		// file descriptor. Report EOF rather than an error: TeX's interactive
		// error prompt reads the terminal, and a hard error there can spin.
		fd_read: (_fd: number, _iovs: number, _len: number, nread: number) => {
			view().setUint32(nread, 0, true);
			return WASI_ESUCCESS;
		},
		fd_close: () => WASI_ESUCCESS,
		fd_seek: () => WASI_ESUCCESS,
		args_sizes_get: (count: number, size: number) => {
			const dv = view();
			dv.setUint32(count, 0, true);
			dv.setUint32(size, 0, true);
			return WASI_ESUCCESS;
		},
		args_get: () => WASI_ESUCCESS,
		environ_sizes_get: (count: number, size: number) => {
			const dv = view();
			dv.setUint32(count, 0, true);
			dv.setUint32(size, 0, true);
			return WASI_ESUCCESS;
		},
		environ_get: () => WASI_ESUCCESS,
		clock_time_get: (_id: number, _prec: bigint, out: number) => {
			view().setBigUint64(out, BigInt(Date.now()) * 1_000_000n, true);
			return WASI_ESUCCESS;
		},
		random_get: (ptr: number, len: number) => {
			crypto.getRandomValues(bytes().subarray(ptr, ptr + len));
			return WASI_ESUCCESS;
		},
		proc_exit: (code: number) => {
			throw new ExitStatus(code);
		}
	};

	const env = {
		invoke_iii: invoke,
		invoke_iiii: invoke,
		invoke_iiiii: invoke,
		invoke_vii: invoke,
		invoke_iiij: invoke,
		invoke_iiiiiiiiiiji: invoke,
		// Emscripten renamed this. Current builds import `_emscripten_throw_longjmp`
		// and pass no arguments — the jmp_buf and return value are handled on the
		// C side, and the import exists only to unwind. Older builds imported
		// `emscripten_longjmp(env, value)`.
		//
		// Both are declared because an unused import is harmless (WebAssembly only
		// reads the names the module actually asks for), whereas a missing one is
		// a hard LinkError at instantiation. This keeps the wrapper able to load
		// the pre-rewrite artifact as well as current builds.
		_emscripten_throw_longjmp: () => {
			throw new LongjmpError();
		},
		emscripten_longjmp: () => {
			throw new LongjmpError();
		},
		emscripten_notify_memory_growth: () => {},
		// Graphite shaping is not linked. Returning null makes HarfBuzz fall
		// back to OpenType shaping, which covers every font we ship.
		hb_graphite2_face_get_gr_face: () => 0,
		__main_argc_argv: () => 0,
		__syscall_getcwd: (buf: number, size: number) => {
			if (size < 2) return -1;
			const mem = bytes();
			mem[buf] = 0x2f; // '/'
			mem[buf + 1] = 0;
			return 2;
		},
		// No real filesystem to unlink from; the engine only ever removes files
		// it created inside its own in-memory provider.
		__syscall_unlinkat: () => 0,
		__syscall_rmdir: () => 0
	};

	return {
		imports: { env, wasi_snapshot_preview1: wasi },
		bind(t: ShimTarget) {
			target = t;
		}
	};
}
