<script lang="ts">
	import { cn } from '@glyphx/ui/utils';

	// Step 1's "Open the project you already have" mock. A faux file-tree on
	// the left and a tiny preview pane on the right, styled in the app's
	// token language so it reads as part of the product rather than a generic
	// editor screenshot. Loops selection through the file tree so the card
	// reads as "live" without claiming features the page doesn't back up.

	type Props = {
		class?: string;
	};

	let { class: className = '' }: Props = $props();

	type Entry = { icon: 'file' | 'folder' | 'chapter'; name: string; active?: boolean };

	const tree: Entry[] = [
		{ icon: 'folder', name: 'thesis/' },
		{ icon: 'file', name: 'main.tex', active: true },
		{ icon: 'file', name: 'references.bib' },
		{ icon: 'folder', name: 'chapters/' },
		{ icon: 'chapter', name: 'intro.tex' },
		{ icon: 'chapter', name: 'methods.tex' },
		{ icon: 'chapter', name: 'results.tex' }
	];

	const reducedMotion =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	let selected = $state(1);

	$effect(() => {
		if (reducedMotion) return;
		const id = setInterval(() => {
			if (document.hidden) return;
			selected = (selected + 1) % tree.length;
		}, 1800);
		return () => clearInterval(id);
	});
</script>

<div class={cn('flex h-full min-h-[22rem] gap-3 p-4', className)}>
	<!-- Faux file tree -->
	<div
		class="flex w-44 shrink-0 flex-col gap-0.5 rounded-xl border border-hairline/70 bg-card/70 p-2.5 font-mono text-xs"
	>
		{#each tree as entry, i (entry.name)}
			{@const isSelected = i === selected}
			<div
				class={cn(
					'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-300',
					isSelected ? 'bg-foreground/8 text-foreground' : 'text-muted-foreground'
				)}
			>
				{#if entry.icon === 'folder'}
					<span class="text-signal-cyan">▸</span>
				{:else if entry.icon === 'file'}
					<span class="text-signal-blue">≡</span>
				{:else}
					<span class="text-signal-lime/80">·</span>
				{/if}
				<span class="font-medium">{entry.name}</span>
			</div>
		{/each}
	</div>

	<!-- Faux editor pane -->
	<div
		class="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-hairline/70 bg-card/70 p-4 font-mono text-xs"
	>
		<div class="flex items-center justify-between text-xs text-muted-foreground">
			<span>main.tex</span>
			<span class="inline-flex items-center gap-1.5">
				<span class="size-1.5 rounded-full bg-success"></span>
				Compiled · 0 errors
			</span>
		</div>
		<div class="border-t border-hairline/60"></div>
		<div class="flex flex-col gap-1.5 text-foreground/85">
			<div>
				<span class="text-signal-blue">\documentclass</span><span class="text-muted-foreground"
					>&#123;</span
				>article<span class="text-muted-foreground">&#125;</span>
			</div>
			<div>
				<span class="text-signal-blue">\usepackage</span><span class="text-muted-foreground"
					>&#123;</span
				>amsmath,graphicx<span class="text-muted-foreground">&#125;</span>
			</div>
			<div class="mt-3">
				<span class="text-signal-blue">\title</span><span class="text-muted-foreground">&#123;</span
				>A local-first workflow for academic writing<span class="text-muted-foreground">&#125;</span
				>
			</div>
			<div>
				<span class="text-signal-blue">\begin</span><span class="text-muted-foreground">&#123;</span
				>document<span class="text-muted-foreground">&#125;</span>
			</div>
			<div class="mt-2 text-foreground/70">A working thesis is just a folder of</div>
			<div class="text-foreground/70">
				plain <span class="text-signal-blue">.tex</span> files. Open one, write,
			</div>
			<div class="text-foreground/70">and the PDF stays in sync.</div>
			<div class="mt-1 text-signal-lime">\end&#123;document&#125;</div>
		</div>
	</div>
</div>
