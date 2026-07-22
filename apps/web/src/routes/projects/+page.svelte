<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ProjectsHome } from '@glyphx/ui/application';
	import { toast } from '@glyphx/ui/sonner';
	import { onMount } from 'svelte';

	import StoragePanel from '$lib/StoragePanel.svelte';
	import { toProjectCard } from '$lib/storage/bridge';
	import {
		createProject,
		deleteProject,
		duplicateProject,
		listProjects,
		renameProject,
		type StoredProject
	} from '$lib/storage/projects';
	import { requestPersistence } from '$lib/storage/quota';
	import { starterFiles } from '$lib/storage/template';
	import { Logo } from '@glyphx/ui/logo';

	let stored = $state<StoredProject[]>([]);
	let loading = $state(true);
	let failure = $state<string | undefined>(undefined);
	let storageOpen = $state(false);

	const projects = $derived(stored.map(toProjectCard));

	function report(error: unknown, fallback: string): void {
		const message = error instanceof Error ? error.message : fallback;
		toast.error(message);
		console.error('[GlyphX]', error);
	}

	async function refresh(): Promise<void> {
		stored = await listProjects();
	}

	onMount(async () => {
		try {
			await refresh();
			// Only ask once there is something worth keeping; a prompt on an empty
			// app is noise, and Firefox shows a real permission dialog.
			if (stored.length > 0) void requestPersistence();
		} catch (error) {
			failure = error instanceof Error ? error.message : 'Could not read saved documents.';
		} finally {
			loading = false;
		}
	});

	async function handleCreate(): Promise<string | void> {
		try {
			const project = await createProject('Untitled', starterFiles());
			await refresh();
			void requestPersistence();
			return project.id;
		} catch (error) {
			report(error, 'Could not create the document.');
		}
	}

	function open(id: string): void {
		void goto(resolve(`/projects/${id}` as `/projects/${string}`));
	}

	async function rename(id: string, name: string): Promise<void> {
		try {
			await renameProject(id, name);
			await refresh();
		} catch (error) {
			report(error, 'Could not rename the document.');
		}
	}

	async function duplicate(id: string): Promise<void> {
		try {
			await duplicateProject(id);
			await refresh();
		} catch (error) {
			report(error, 'Could not duplicate the document.');
		}
	}

	async function remove(id: string): Promise<void> {
		try {
			await deleteProject(id);
			await refresh();
		} catch (error) {
			report(error, 'Could not delete the document.');
		}
	}
</script>

<svelte:head>
	<title>Documents · GlyphX</title>
	<meta name="description" content="Your GlyphX LaTeX documents, stored in this browser." />
</svelte:head>

{#if loading}
	<div class="flex min-h-dvh items-center justify-center flex-col gap-4 text-center">
		<Logo size="lg" />
		<p class="text-sm text-muted-foreground" role="status">Loading your documents…</p>
	</div>
{:else if failure}
	<div
		class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
	>
		<h1 class="text-lg font-semibold">Local storage is unavailable</h1>
		<p class="text-sm text-muted-foreground">{failure}</p>
		<p class="text-sm text-muted-foreground">
			Private windows and blocked site data both prevent saving. The
			<a class="underline" href={resolve('/editor')}>scratch editor</a> still works.
		</p>
	</div>
{:else}
	<ProjectsHome
		platform="web"
		{projects}
		oncreate={handleCreate}
		onopen={open}
		onrename={rename}
		onduplicate={duplicate}
		ondelete={remove}
		onsettings={() => (storageOpen = true)}
	/>
{/if}

<StoragePanel bind:open={storageOpen} />
