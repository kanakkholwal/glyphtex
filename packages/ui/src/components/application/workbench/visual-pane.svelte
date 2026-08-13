<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import { settings } from '@glyphtex/ui/settings';
	import { IconFlask2, IconMathFunction, IconSparkles } from '@tabler/icons-svelte';

	import type { WorkbenchController } from './controller.svelte';

	/**
	 * Visual (WYSIWYG) editing surface. **Not shipped** — this renders a fixed
	 * specimen document so the intended typography and canvas can be reviewed and
	 * built against. It never reads or writes the real project.
	 */
	let { ctrl }: { ctrl: WorkbenchController } = $props();

	const layout = $derived(ctrl.layout);
	const files = $derived(ctrl.files);

	const bodySize = $derived(settings.docSmallText ? '0.875rem' : '1rem');
	const measure = $derived(settings.docFullWidth ? 'none' : '708px');
</script>

<section
	class="bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-auto"
	aria-label="Visual editor preview"
>
	<div
		class="mx-auto w-full px-6 pt-6 pb-24 sm:px-12 lg:px-16"
		style:max-width={settings.docFullWidth ? 'none' : '900px'}
	>
		<div
			class="border-border bg-card mb-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3.5 py-3"
			role="status"
		>
			<IconFlask2 size={17} class="text-brand shrink-0" />
			<div class="min-w-0 flex-1">
				<p class="text-foreground text-sm font-medium">Visual editing isn't shipped yet</p>
				<p class="text-muted-foreground mt-0.5 text-xs leading-relaxed">
					This is a specimen of the writing surface we're building, not
					<span class="font-medium">{files.displayName}</span>. Edit the real document in LaTeX.
				</p>
			</div>
			<Button size="sm" variant="outline" class="h-8" onclick={() => (layout.docMode = 'latex')}>
				Open in LaTeX
			</Button>
		</div>

		<!-- `inert` is what actually keeps the specimen out of the tab order and off
		     the a11y tree; the banner above it carries the explanation. -->
		<article
			inert
			class="glyphtex-doc mx-auto cursor-default select-text"
			style:max-width={measure}
			style:font-family={settings.docFontStack}
			style:font-size={bodySize}
		>
			<h1 class="text-foreground text-[2.5rem] leading-[1.15] font-bold tracking-[-0.022em]">
				A local-first writing surface
			</h1>
			<p class="text-muted-foreground mt-2 text-sm">Specimen · not editable</p>

			<p class="text-foreground mt-8 leading-[1.6]">
				Type the way you think. Structure, maths and citations stay real LaTeX underneath, so the
				PDF you export is the one your journal expects — and nothing leaves this device.
			</p>

			<h2
				class="text-foreground mt-10 mb-1 text-[1.5rem] leading-tight font-semibold tracking-[-0.015em]"
			>
				How it will work
			</h2>
			<p class="text-foreground leading-[1.6]">
				Every block maps to a LaTeX construct. Switching to the LaTeX view shows exactly what was
				written, with your cursor in the same place.
			</p>

			<ul class="mt-4 space-y-1.5 pl-1">
				{#each ['Headings become \\section and \\subsection', 'Lists become itemize and enumerate', 'Citations resolve against your .bib file'] as item (item)}
					<li class="text-foreground flex gap-2.5 leading-[1.6]">
						<span class="text-faint mt-[0.7em] size-1.5 shrink-0 rounded-full bg-current"></span>
						<span>{item}</span>
					</li>
				{/each}
			</ul>

			<div class="border-border bg-surface-soft mt-6 rounded-lg border px-4 py-3.5">
				<div class="text-muted-foreground flex items-center gap-2 text-xs font-medium">
					<IconMathFunction size={14} /> Equation block
				</div>
				<p class="text-foreground mt-2.5 text-center text-lg" style:font-family="Georgia, serif">
					<em>E</em> = <em>mc</em><sup>2</sup>
				</p>
			</div>

			<p class="text-foreground mt-6 leading-[1.6]">
				Inline maths keeps its source form — <code
					class="bg-muted text-brand rounded px-1.5 py-0.5 text-[0.85em]">$\hat\theta$</code
				> — and renders as you type.
			</p>

			<div class="border-border mt-12 flex items-center gap-2 border-t pt-6">
				<IconSparkles size={14} class="text-faint shrink-0" />
				<p class="text-faint text-xs">
					Blocks, slash commands and drag-to-reorder are in design. Follow the changelog for
					progress.
				</p>
			</div>
		</article>
	</div>
</section>
