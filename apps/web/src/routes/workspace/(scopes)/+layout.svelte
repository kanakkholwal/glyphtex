<script lang="ts">
	import { page } from '$app/state';
	import type { Scope } from '@glyphtex/ui/application';

	import WorkspaceHome from '$lib/workspace/WorkspaceHome.svelte';

	// The layout renders the whole workspace so the rail, its collapsed state, and
	// the loaded project list survive scope navigation; the pages are route markers.
	const scope = $derived<Scope>(
		page.url.pathname.endsWith('/recent')
			? 'recent'
			: page.url.pathname.endsWith('/starred')
				? 'starred'
				: page.url.pathname.endsWith('/templates')
					? 'templates'
					: 'all'
	);
</script>

<WorkspaceHome {scope} />
