<script lang="ts">
	import { EngineSettings } from '@glyphx/ui/application';
	import { engineManager } from '$lib/engine';
</script>

<div class="flex max-w-2xl flex-col gap-8">
	<header>
		<h2 class="font-display text-xl font-semibold tracking-tight">Engine</h2>
		<p class="text-muted-foreground mt-1.5 text-sm">
			Choose how GlyphX compiles. Bundled Tectonic needs no install; System TeX uses your local TeX
			Live / MiKTeX for documents Tectonic can't render.
		</p>
	</header>

	<section class="flex flex-col gap-2.5">
		<h3 class="text-muted-foreground px-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
			LaTeX engine
		</h3>
		<div class="bg-card border-border rounded-xl border p-4">
			<EngineSettings engine={engineManager} />
		</div>
	</section>
</div>
