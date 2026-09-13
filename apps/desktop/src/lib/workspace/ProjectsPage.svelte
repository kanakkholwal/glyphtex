<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { message } from "@tauri-apps/plugin-dialog";
	import { ProjectsHome, type Scope } from "@glyphtex/ui/application";
	import {
		loadTemplateCatalog,
		loadTemplateFiles,
		type ProjectTemplate
	} from "@glyphtex/ui/project-templates";
	import { projects } from "@glyphtex/ui/projects";
	import { projectHost } from "$lib/project";
	import { gitProvider } from "$lib/git";

	let { scope = "all" }: { scope?: Scope } = $props();

	const scopeHrefs: Partial<Record<Scope, string>> = {
		all: resolve("/"),
		recent: resolve("/recent"),
		starred: resolve("/starred"),
		templates: resolve("/templates")
	};

	const titles: Record<Scope, string> = {
		all: "Projects",
		recent: "Recent",
		starred: "Starred",
		templates: "Templates"
	};

	// App-data projects show even if their stored reference was lost (cleared storage, new machine).
	// The scan never reorders existing entries.
	onMount(async () => {
		if (!projectHost.listLocalProjects) return;
		try {
			const local = await projectHost.listLocalProjects();
			for (const lp of local) projects.ensure(lp.root, lp.name, lp.modified);
		} catch {
			/* directory unavailable: fall back to the stored list */
		}
	});

	/** Plain-language dialog with the raw cause after it, for bug reports. */
	async function reportError(title: string, plain: string, e: unknown) {
		console.error(`[projects] ${title}`, e);
		await message(`${plain}\n\nDetails: ${String(e)}`, { title, kind: "error" });
	}

	// Created in the app data dir without a save prompt; falls back to in-memory if that fails.
	// Returns the id so ProjectsHome can reveal the card before morphing into the editor.
	async function newProject(): Promise<string | undefined> {
		try {
			if (projectHost.createLocalProject) {
				const root = await projectHost.createLocalProject("Untitled project");
				return projects.remember(root).id;
			}
		} catch (e) {
			await reportError(
				"Couldn't create project folder",
				"GlyphTeX couldn't create a folder for the project, so it is kept inside the app instead.",
				e
			);
		}
		return projects.create().id;
	}

	// The catalog is a lazy chunk, fetched the first time the Templates scope opens.
	let templates = $state.raw<ProjectTemplate[]>([]);
	let templatesLoading = $state(false);
	let catalogRequested = false;

	$effect(() => {
		if (scope !== "templates" || catalogRequested) return;
		catalogRequested = true;
		templatesLoading = true;
		loadTemplateCatalog()
			.then((list) => (templates = list))
			.catch((e) =>
				reportError("Couldn't load templates", "The template gallery failed to load.", e)
			)
			.finally(() => (templatesLoading = false));
	});

	async function createFromTemplate(id: string): Promise<string | undefined> {
		const template = templates.find((t) => t.id === id);
		try {
			if (!projectHost.createLocalProject) return undefined;
			const [files, root] = await Promise.all([
				loadTemplateFiles(id),
				projectHost.createLocalProject(template?.title ?? "Untitled project")
			]);
			await Promise.all(files.map((f) => projectHost.writeFile(`${root}/${f.path}`, f.text)));
			return projects.remember(root).id;
		} catch (e) {
			await reportError(
				"Couldn't create from template",
				"GlyphTeX couldn't create a project from that template.",
				e
			);
			return undefined;
		}
	}

	async function openFolder() {
		const root = await projectHost.pickFolder("Open project folder");
		if (!root) return;
		const p = projects.remember(root);
		goto(resolve(`/editor/${p.id}`));
	}

	async function importZip() {
		const zip = await projectHost.pickImportFile();
		if (!zip) return;
		try {
			const root = await projectHost.importZip(zip);
			if (!root) return;
			const p = projects.remember(root);
			goto(resolve(`/editor/${p.id}`));
		} catch (e) {
			await reportError(
				"Import failed",
				"GlyphTeX couldn't import that file. Check that it is a valid .zip, .glyx or .tex file.",
				e
			);
		}
	}

	/** Clone folder name: the URL's last segment minus `.git`, never `.`, `..` or a nested path. */
	function repoName(url: string): string {
		const last = url
			.replace(/\.git$/i, "")
			.replace(/[/\\:]+$/, "")
			.split(/[/\\:]/)
			.pop()
			?.replace(/[<>"|?*]/g, "")
			.trim();
		return last && !/^\.+$/.test(last) ? last : "repository";
	}

	async function cloneRepo(url: string) {
		const parent = await projectHost.pickFolder("Choose where to clone the repository");
		if (!parent) return;
		const dest = `${parent}/${repoName(url)}`;
		try {
			const root = await gitProvider.clone(url, dest);
			const p = projects.remember(root);
			goto(resolve(`/editor/${p.id}`));
		} catch (e) {
			await reportError(
				"Clone failed",
				"GlyphTeX couldn't clone that repository. Check the URL and your connection.",
				e
			);
		}
	}
</script>

<svelte:head>
	<title>GlyphTeX: {titles[scope]}</title>
</svelte:head>

<ProjectsHome
	activeScope={scope}
	{scopeHrefs}
	projects={projects.list}
	oncreate={newProject}
	{templates}
	{templatesLoading}
	onusetemplate={createFromTemplate}
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
		// Disk-backed: the confirm dialog names the folder, and deleting removes it from disk.
		if (p?.root) {
			try {
				await projectHost.remove(p.root);
			} catch (e) {
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
