import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import type { ProjectFile, ProjectHost } from '@glyphtex/ui/application';

/**
 * Desktop project host — folder-based LaTeX projects backed by Tauri's native
 * dialogs and the Rust `project` module (std::fs + zip). Wired into
 * `<Workbench project={projectHost} />`. The web build leaves this undefined.
 */
export const projectHost: ProjectHost = {
	createLocalProject: (name) => invoke<string>('create_local_project', { name }),
	listLocalProjects: () =>
		invoke<{ root: string; name: string; modified: number }[]>('list_local_projects'),

	pickFolder: async (title) => {
		const sel = await open({ directory: true, multiple: false, title });
		return typeof sel === 'string' ? sel : null;
	},

	pickImportFile: async () => {
		const sel = await open({
			multiple: false,
			filters: [
				{ name: 'GlyphTeX project / archive', extensions: ['zip', 'glyx', 'tex'] },
				{ name: 'All files', extensions: ['*'] }
			]
		});
		return typeof sel === 'string' ? sel : null;
	},

	readFiles: (root) => invoke<ProjectFile[]>('read_project_files', { root }),
	readFile: (abs) => invoke<string>('read_file_text', { path: abs }),
	readFileBytes: (abs) => readFile(abs),
	writeFile: (abs, content) => invoke<void>('write_file_text', { path: abs, content }),
	createEntry: (abs, dir) => invoke<void>('create_path', { path: abs, dir }),
	rename: (from, to) => invoke<void>('rename_path', { from, to }),
	remove: (abs) => invoke<void>('delete_path', { path: abs }),
	exists: (abs) => invoke<boolean>('path_exists', { path: abs }),

	importZip: async (zipPath) => {
		const dest = await open({
			directory: true,
			multiple: false,
			title: 'Choose where to extract the project'
		});
		if (typeof dest !== 'string') return null;
		return invoke<string>('import_zip', { zipPath, destParent: dest });
	},

	exportZip: async (root, defaultName) => {
		const out = await save({
			defaultPath: defaultName,
			filters: [{ name: 'ZIP archive', extensions: ['zip'] }]
		});
		if (!out) return false;
		await invoke<void>('export_zip', { root, outPath: out });
		return true;
	},

	revealInOS: (path) => revealItemInDir(path),

	takeLaunchPath: () => invoke<string | null>('take_launch_path'),
	onOpenPath: (cb) => listen<string>('glyphtex://open-path', (e) => cb(e.payload)),
	registerShellIntegration: () => invoke<string>('register_shell_integration'),
	unregisterShellIntegration: () => invoke<string>('unregister_shell_integration'),
	shellIntegrationRegistered: () => invoke<boolean>('shell_integration_registered')
};
