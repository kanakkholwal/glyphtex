import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { isTauriRuntime } from '$lib/runtime';

/**
 * Save bytes to disk via Tauri's native "Save As" dialog (`plugin-dialog`) and
 * `plugin-fs`. Returns `true` once written, `false` if the user cancels the
 * dialog. Outside Tauri (desktop dev server in a plain browser) it falls back
 * to a normal browser download so the button still works.
 *
 * Wired into `<Workbench saveFile={saveFile} />`.
 */
export async function saveFile(
	bytes: Uint8Array,
	opts: { filename: string; extensions?: string[] }
): Promise<boolean> {
	const extensions = opts.extensions ?? ['pdf'];

	if (!isTauriRuntime()) {
		const blob = new Blob([bytes as BlobPart]);
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = opts.filename;
		a.click();
		URL.revokeObjectURL(url);
		return true;
	}

	const path = await save({
		defaultPath: opts.filename,
		filters: [{ name: extensions.join('/').toUpperCase(), extensions }]
	});
	if (!path) return false; // user dismissed the dialog

	await writeFile(path, bytes);
	return true;
}
