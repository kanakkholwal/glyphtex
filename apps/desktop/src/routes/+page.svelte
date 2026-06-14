<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { message } from '@tauri-apps/plugin-dialog';
	import { ProjectsHome } from '@glyphx/ui/application';
	import { projects } from '@glyphx/ui/projects';
	import { projectHost } from '$lib/project';
	import { gitProvider } from '$lib/git';

	/**
	 * New project — created on disk in the app's own data directory by default
	 * (no save prompt). Falls back to an in-memory project if that fails. Returns
	 * the new id so ProjectsHome can reveal the card, then morph into the editor.
	 */
	async function newProject(): Promise<string | undefined> {
		try {
			if (projectHost.createLocalProject) {
				const root = await projectHost.createLocalProject('Untitled project');
				return projects.remember(root).id;
			}
		} catch (e) {
			await message(String(e), { title: 'Could not create project', kind: 'error' });
		}
		return projects.create().id;
	}

	/** Open a disk-backed project folder: remember it, then route to the editor. */
	async function openFolder() {
		const root = await projectHost.pickFolder('Open project folder');
		if (!root) return;
		const p = projects.remember(root);
		goto(resolve(`/editor/${p.id}`));
	}

	/** Import a .zip → extracted folder → remember → editor. */
	async function importZip() {
		const zip = await projectHost.pickImportFile();
		if (!zip) return;
		const root = await projectHost.importZip(zip);
		if (!root) return;
		const p = projects.remember(root);
		goto(resolve(`/editor/${p.id}`));
	}

	/** The repo folder name from a clone URL (last path segment, minus `.git`). */
	function repoName(url: string): string {
		const last = url
			.replace(/\.git$/i, '')
			.replace(/[/\\]+$/, '')
			.split(/[/\\]/)
			.pop();
		return last && last.length ? last : 'repository';
	}

	/** Clone a Git repo: pick a parent folder natively, clone into it, then open. */
	async function cloneRepo(url: string) {
		const parent = await projectHost.pickFolder('Choose where to clone the repository');
		if (!parent) return;
		const dest = `${parent}/${repoName(url)}`;
		try {
			const root = await gitProvider.clone(url, dest);
			const p = projects.remember(root);
			goto(resolve(`/editor/${p.id}`));
		} catch (e) {
			await message(String(e), { title: 'Clone failed', kind: 'error' });
		}
	}
</script>

<svelte:head>
	<title>GlyphX — Projects</title>
</svelte:head>

<ProjectsHome
	projects={projects.list}
	oncreate={newProject}
	onopenfolder={openFolder}
	onimport={importZip}
	onclone={cloneRepo}
	onopen={(id) => {
		projects.touch(id);
		goto(resolve(`/editor/${id}`));
	}}
	onrename={(id, name) => projects.rename(id, name)}
	onduplicate={(id) => projects.duplicate(id)}
	ondelete={(id) => projects.remove(id)}
	onreveal={(id) => {
		const p = projects.list.find((x) => x.id === id);
		if (p?.root) void projectHost.revealInOS?.(p.root);
	}}
	onsettings={() => goto(resolve('/settings'))}
/>
