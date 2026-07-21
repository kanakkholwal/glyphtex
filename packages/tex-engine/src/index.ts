/**
 * `@glyphx/tex-engine` — LaTeX to PDF in the browser and on the server.
 *
 * Wraps Tectonic (XeTeX + xdvipdfmx) compiled to WebAssembly. The document
 * types are generated from the Rust definitions, so they cannot drift from what
 * the engine actually accepts and returns.
 *
 * @example
 * ```ts
 * const engine = await TexEngine.load(fetch('/tectonic.wasm'));
 * for (const [name, bytes] of bundle) engine.addFile(name, bytes);
 * engine.addFile('main.tex', '\\documentclass{article}\\begin{document}Hi\\end{document}');
 *
 * const result = engine.compile({ entry: 'main.tex', synctex: true });
 * if (result.status !== 'failed') {
 *   const pdf = engine.pdf();
 * }
 * for (const d of result.diagnostics) {
 *   console.log(`${d.severity} ${d.file ?? '?'}:${d.line ?? '?'} ${d.message}`);
 * }
 * ```
 */

export { TexEngine, EngineError, SUPPORTED_ABI_VERSION } from './engine.js';
export type { CompileRequest, WasmSource } from './engine.js';
export { ExitStatus } from './imports.js';
export type { EngineIo } from './imports.js';

export type {
	CompileOptions,
	CompileResult,
	CompileStatus,
	Diagnostic,
	LogLevel,
	OutputFile,
	OutputFormat,
	OutputKind,
	Severity
} from './generated/index.js';
