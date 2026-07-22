import type { GlyphFile } from '@glyphtex/ui/application';
import type { Project } from '@glyphtex/ui/projects';
import type { CompileFile } from '$lib/compile';
import { isBinaryPath, type NewFile, type StoredFile, type StoredProject } from './projects';

/** Placeholder body for a binary file, which the text editor cannot represent. */
const BINARY_NOTE = '% Binary file — edited outside GlyphTeX, included as-is.\n';

/** Card metadata only: `files` carries paths so counts render without contents. */
export function toProjectCard(p: StoredProject): Project {
	return {
		id: p.id,
		name: p.name,
		files: p.paths.map((path) => ({ id: path, name: path, content: '' })),
		createdAt: p.createdAt,
		updatedAt: p.updatedAt,
		starred: p.starred
	};
}

export function toGlyphFiles(files: StoredFile[]): GlyphFile[] {
	return files.map((f) => {
		const content = f.data ? BINARY_NOTE : (f.text ?? '');
		return { id: f.path, name: f.path, content, saved: content };
	});
}

/** Workbench files back to storage. Binary members keep their stored bytes — the
 *  editor only ever held a placeholder for them. */
export function toNewFiles(files: GlyphFile[], binary: Map<string, Uint8Array>): NewFile[] {
	return files.map((f) => {
		const data = binary.get(f.name);
		return data ? { path: f.name, data } : { path: f.name, text: f.content };
	});
}

/** Engine input: saved text plus the real bytes for every binary asset. */
export function toCompileFiles(files: GlyphFile[], binary: Map<string, Uint8Array>): CompileFile[] {
	return files.map((f) => {
		const data = binary.get(f.name);
		if (data) return { name: f.name, data };
		// `saved` is what the engine should see; an unsaved buffer compiles only
		// after the workbench flushes it.
		return { name: f.name, text: f.saved ?? f.content };
	});
}

export function binaryMap(files: StoredFile[]): Map<string, Uint8Array> {
	const map = new Map<string, Uint8Array>();
	for (const f of files) if (f.data) map.set(f.path, f.data);
	return map;
}

export { isBinaryPath };
