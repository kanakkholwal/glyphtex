<script lang="ts">
	import { page } from '$app/state';
	import type { Scope } from '@glyphtex/ui/application';

	import WorkspaceHome from '$lib/workspace/WorkspaceHome.svelte';

	// The layout renders the whole workspace so the rail, its collapsed state, and
	// the loaded project list survive scope navigation; the pages are route markers.
	const segment = $derived(page.url.pathname.split('/').filter(Boolean).at(-1) ?? '');
	const scope = $derived<Scope>(
		segment === 'recent' || segment === 'starred' || segment === 'templates' ? segment : 'all'
	);
</script>

<WorkspaceHome {scope} />
