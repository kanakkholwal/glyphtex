<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Workbench } from '@glyphtex/ui/application';
	import { projects, projectViewTransitionName } from '@glyphtex/ui/projects';
	import { compileLatex, compileProject } from '$lib/compile';
	import { engineManager } from '$lib/engine';
	import { gitProvider } from '$lib/git';
	import { projectHost } from '$lib/project';
	import { saveFile } from '$lib/save';

	const project = $derived(projects.get(page.params.id ?? ''));

	// Unknown id (e.g. a deleted project) → back to the projects home.
	$effect(() => {
		if (!project) goto(resolve('/'));
	});
</script>

<svelte:head>
	<title>{project ? `${project.name} — GlyphTeX` : 'GlyphTeX'}</title>
</svelte:head>

{#if project}
	{#key project.id}
		<!-- Editor surface shares the project's view-transition-name, so it morphs
		     out of (and back into) the home card. -->
		<div
			class="h-dvh"
			style:view-transition-name={projectViewTransitionName(project.id)}
			style:view-transition-class="morph-surface"
		>
			<Workbench
				platform="desktop"
				compile={compileLatex}
				{compileProject}
				engine={engineManager}
				git={gitProvider}
				project={projectHost}
				openPathOnMount={project.root}
				{saveFile}
				projectName={project.name}
				initialFiles={project.files}
				onpersist={(files) => projects.save(project.id, files)}
			/>
		</div>
	{/key}
{/if}
