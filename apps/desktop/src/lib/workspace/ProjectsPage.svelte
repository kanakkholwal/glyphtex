<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { message } from '@tauri-apps/plugin-dialog';
	import { ProjectsHome, type Scope } from '@glyphtex/ui/application';
	import { projects } from '@glyphtex/ui/projects';
	import { projectHost } from '$lib/project';
	import { gitProvider } from '$lib/git';

	let { scope = 'all' }: { scope?: Scope } = $props();

	const scopeHrefs: Partial<Record<Scope, string>> = {
		all: resolve('/'),
		recent: resolve('/recent'),
		starred: resolve('/starred'),
		templates: resolve('/templates')
	};

	const titles: Record<Scope, string> = {
		all: 'Projects',
		recent: 'Recent',
		starred: 'Starred',
		templates: 'Templates'
	};

	// Reflect what's actually on disk: every project folder GlyphTeX manages in its
	// own data directory shows on the home page, even if its remembered reference
	// was lost (cleared storage, fresh machine). Imported / opened folders keep
	// living in the store. The scan never reorders existing entries.
	onMount(async () => {
		if (!projectHost.listLocalProjects) return;
		try {
			const local = await projectHost.listLocalProjects();
			for (const lp of local) projects.ensure(lp.root, lp.name, lp.modified);
		} catch {
			/* directory unavailable — fall back to the stored list */
		}
	});

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
	<title>GlyphTeX — {titles[scope]}</title>
</svelte:head>

<ProjectsHome
	activeScope={scope}
	{scopeHrefs}
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
	ondelete={async (id) => {
		const p = projects.list.find((x) => x.id === id);
		// Disk-backed project → remove the folder from the file system too, so
		// deleting from the home actually frees the project on disk.
		if (p?.root) {
			try {
				await projectHost.remove(p.root);
			} catch (e) {
				// Plain language for the dialog; raw cause to the console (§5).
				console.error('[projects] delete folder failed', e);
				await message(
					'Could not delete the project folder. It may be open in another program, or it may have already been removed.',
					{ title: 'Delete failed', kind: 'error' }
				);
				return; // keep the entry so the user can retry
			}
		}
		projects.remove(id);
	}}
	onreveal={(id) => {
		const p = projects.list.find((x) => x.id === id);
		if (p?.root) void projectHost.revealInOS?.(p.root);
	}}
	onstar={(id, starred) => projects.setStarred(id, starred)}
	onsettings={() => goto(resolve('/settings'))}
/>
