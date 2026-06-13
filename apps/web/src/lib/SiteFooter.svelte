<script lang="ts">
	import { resolve } from '$app/paths';
	import { Logo } from '@glyphx/ui/logo';
	import { IconBrandGithub } from '@tabler/icons-svelte';

	const home = resolve('/');
	const repo = 'https://github.com/kanakkholwal/glyph';
	const year = 2026;

	const groups = [
		{
			title: 'Product',
			links: [
				{ label: 'Features', href: `${home}#features` },
				{ label: 'Compare', href: `${home}#compare` },
				{ label: 'Download', href: resolve('/download') },
				{ label: 'Open the editor', href: resolve('/editor') }
			]
		},
		{
			title: 'Project',
			links: [
				{ label: 'Why we built it', href: `${home}#why` },
				{ label: 'FAQ', href: `${home}#faq` },
				{ label: 'Source code', href: repo, external: true },
				{ label: 'Releases', href: `${repo}/releases`, external: true }
			]
		}
	];
</script>

<footer class="border-hairline bg-canvas border-t">
	<div class="mx-auto max-w-[1140px] px-5 py-14 sm:px-6">
		<div class="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
			<div class="max-w-xs">
				<Logo href={home} size="md" class="text-foreground" />
				<p class="text-muted-foreground mt-4 text-sm leading-relaxed">
					A LaTeX editor that runs on your machine. Your drafts stay on your disk, your work
					compiles offline, and there is no account to sign up for.
				</p>
				<a
					href={repo}
					target="_blank"
					rel="noreferrer"
					class="border-hairline bg-card text-muted-foreground hover:text-foreground mt-5 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
				>
					<IconBrandGithub class="size-4" /> Star it on GitHub
				</a>
			</div>

			{#each groups as g (g.title)}
				<div>
					<h3 class="text-foreground text-xs font-semibold tracking-wider uppercase">{g.title}</h3>
					<ul class="mt-4 flex flex-col gap-3">
						{#each g.links as l (l.label)}
							<li>
								<a
									class="text-muted-foreground hover:text-foreground text-sm transition-colors"
									href={l.href}
									target={l.external ? '_blank' : undefined}
									rel={l.external ? 'noreferrer' : undefined}>{l.label}</a
								>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>

		<div
			class="border-hairline text-muted-foreground/80 mt-12 flex flex-col items-start justify-between gap-3 border-t pt-6 font-mono text-xs sm:flex-row sm:items-center"
		>
			<span>© {year} GlyphX. Local-first typesetting.</span>
			<span>Built for people who write LaTeX, not for a server farm.</span>
		</div>
	</div>
</footer>
