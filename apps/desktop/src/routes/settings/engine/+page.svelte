<script lang="ts">
	import { EngineSettings } from '@glyphtex/ui/application';
	import { engineManager } from '$lib/engine';
</script>

<div class="flex flex-col gap-8">
	<header>
		<h2 class="font-display text-2xl font-semibold tracking-tight">Engine</h2>
		<p class="text-muted-foreground mt-1.5 text-sm">
			Choose how GlyphTeX compiles. Bundled Tectonic needs no install; System TeX uses your local
			TeX Live / MiKTeX for documents Tectonic can't render.
		</p>
	</header>

	<EngineSettings engine={engineManager} />
</div>
