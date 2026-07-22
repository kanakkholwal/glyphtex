<script lang="ts">
	import { page } from '$app/state';
	import type { Scope } from '@glyphtex/ui/application';

	import ProjectsPage from '$lib/workspace/ProjectsPage.svelte';

	// The layout renders the home so the rail and its collapsed state survive
	// navigation between destinations; the pages below are route markers.
	const segment = $derived(page.url.pathname.split('/').filter(Boolean).at(-1) ?? '');
	const scope = $derived<Scope>(
		segment === 'recent' || segment === 'starred' || segment === 'templates' ? segment : 'all'
	);
</script>

<ProjectsPage {scope} />
