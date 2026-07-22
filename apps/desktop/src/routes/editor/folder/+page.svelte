<script lang="ts">
	import { Workbench } from '@glyphtex/ui/application';
	import { compileLatex, compileProject } from '$lib/compile';
	import { engineManager } from '$lib/engine';
	import { gitProvider } from '$lib/git';
	import { launch } from '$lib/launch';
	import { projectHost } from '$lib/project';
	import { saveFile } from '$lib/save';

	// The path the app shell routed us here to open (file-association launch).
	// Captured once at mount; the Workbench resolves folder / .tex / .glyx itself.
	const openPathOnMount = launch.path ?? undefined;
	launch.path = null;
</script>

<svelte:head>
	<title>GlyphTeX</title>
</svelte:head>

<Workbench
	platform="desktop"
	compile={compileLatex}
	{compileProject}
	engine={engineManager}
	git={gitProvider}
	project={projectHost}
	{openPathOnMount}
	{saveFile}
/>
