import { invoke } from '@tauri-apps/api/core';
import { settings } from '@glyphx/ui/settings';

/** Shape returned by the Rust `compile_latex` command. */
type RawCompileResult = {
	success: boolean;
	pdf_base64: string | null;
	log: string;
	message: string | null;
	synctex: string | null;
	hint: string | null;
};

export type CompileOutcome = {
	pdf?: string;
	log?: string;
	error?: string;
	synctex?: string;
	/** Plain-language, actionable hint for a recognized engine limitation. */
	hint?: string;
};

function isTauri(): boolean {
	return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || 'isTauri' in window);
}

/**
 * Compile LaTeX → PDF via the Tectonic engine in the Rust backend. Returns the
 * PDF as a base64 string on success, or an error message. Outside Tauri (e.g.
 * the desktop dev server in a browser) it reports that compilation is desktop-only.
 */
export async function compileLatex(source: string): Promise<CompileOutcome> {
	if (!isTauri()) {
		return { error: 'Compilation runs in the GlyphX desktop app.' };
	}
	try {
		const res = await invoke<RawCompileResult>('compile_latex', {
			source,
			shellEscape: settings.shellEscape,
			engine: settings.engineKind,
			texProgram: settings.texProgram
		});
		if (res.success && res.pdf_base64)
			return {
				pdf: res.pdf_base64,
				log: res.log,
				synctex: res.synctex ?? undefined,
				hint: res.hint ?? undefined
			};
		return {
			log: res.log,
			error: res.message ?? 'Compilation failed.',
			hint: res.hint ?? undefined
		};
	} catch (e) {
		return { error: String(e) };
	}
}

/**
 * Compile a multi-file project on disk via Tectonic, run against the real
 * project folder so `\input`, `\includegraphics`, `\bibliography` etc. resolve.
 * `mainRel` is the main file's path relative to `root`.
 */
export async function compileProject(root: string, mainRel: string): Promise<CompileOutcome> {
	if (!isTauri()) {
		return { error: 'Compilation runs in the GlyphX desktop app.' };
	}
	try {
		const res = await invoke<RawCompileResult>('compile_project', {
			root,
			main: mainRel,
			shellEscape: settings.shellEscape,
			engine: settings.engineKind,
			texProgram: settings.texProgram
		});
		if (res.success && res.pdf_base64)
			return {
				pdf: res.pdf_base64,
				log: res.log,
				synctex: res.synctex ?? undefined,
				hint: res.hint ?? undefined
			};
		return {
			log: res.log,
			error: res.message ?? 'Compilation failed.',
			hint: res.hint ?? undefined
		};
	} catch (e) {
		return { error: String(e) };
	}
}
