<script lang="ts">
	import { Badge } from '@glyphx/ui/badge';
	import { Logo } from '@glyphx/ui/logo';
</script>

<div class="flex max-w-2xl flex-col gap-8">
	<header>
		<h2 class="font-display text-xl font-semibold tracking-tight">About</h2>
		<p class="text-muted-foreground mt-1.5 text-sm">What GlyphX is, and what it promises.</p>
	</header>

	<section class="bg-card border-border flex flex-col gap-5 rounded-xl border p-5">
		<div class="flex items-center gap-4">
			<Logo text={false} badge size={48} />
			<div class="flex flex-col gap-1">
				<div class="flex items-center gap-2">
					<p class="text-foreground text-base font-medium">GlyphX</p>
					<Badge variant="secondary">v0.1.0</Badge>
				</div>
				<p class="text-muted-foreground text-sm">Local-first LaTeX editor</p>
			</div>
		</div>

		<div class="bg-border/60 h-px"></div>

		<div class="text-muted-foreground flex flex-col gap-3 text-sm leading-relaxed">
			<p>
				GlyphX compiles real LaTeX on your machine with Tectonic — nothing is uploaded, and it works
				fully offline. Your documents stay on disk, in plain files you own.
			</p>
			<p>
				Open any folder as a project, just like a normal LaTeX setup: a main file plus whatever you
				<code class="bg-muted rounded px-1 py-0.5 text-[12px]">\input</code> or include.
			</p>
		</div>
	</section>
</div>
