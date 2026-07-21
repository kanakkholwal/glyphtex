export { TexEngine, EngineError, EnginePoisonedError, SUPPORTED_ABI_VERSION } from './engine.js';
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
