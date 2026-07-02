<script lang="ts">
	import { resolve } from '$app/paths';
	import { Logo } from '@glyphx/ui/logo';
	import {
		IconArrowUpRight,
		IconBrandGithub,
		IconFileCode2
	} from '@tabler/icons-svelte';

	const home = resolve('/');
	const repo = 'https://github.com/kanakkholwal/glyphx';
	const year = 2026;

	type FooterLink = {
		label: string;
		href: string;
		external?: boolean;
	};

	type FooterGroup = {
		title: string;
		links: FooterLink[];
	};

	const groups: FooterGroup[] = [
		{
			title: 'Product',
			links: [
				{ label: 'Features', href: `${home}#features` },
				{ label: 'Workflow', href: `${home}#workflow` },
				{ label: 'Compare', href: `${home}#compare` },
				{ label: 'FAQ', href: `${home}#faq` }
			]
		},
		{
			title: 'Explore',
			links: [
				{ label: 'Download', href: resolve('/download') },
				{ label: 'Open editor', href: resolve('/editor') },
				{ label: 'Source code', href: repo, external: true },
				{ label: 'Releases', href: `${repo}/releases`, external: true }
			]
		}
	];
</script>

<footer class="border-t border-hairline bg-canvas">
	<div class="mx-auto max-w-7xl px-6 py-18 sm:py-24">
		<div class="grid gap-14 border-b border-hairline pb-14 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
			<div class="max-w-md">
				<Logo href={home} size="lg" badge={false} tone="mono" class="text-ink" />
				<p class="mt-6 text-lg leading-8 text-ink-body">
					GlyphX is for people who want the speed of a native writing tool without giving up
					real LaTeX, real files, or control over where their work lives.
				</p>

				<div class="mt-8 flex flex-wrap gap-3">
					<a
						href={repo}
						target="_blank"
						rel="noreferrer"
						class="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-card px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-soft"
					>
						<IconBrandGithub class="size-4" />
						GitHub
					</a>
					<a
						href={repo}
						target="_blank"
						rel="noreferrer"
						class="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-card px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-soft"
					>
						<IconFileCode2 class="size-4" />
						Changelog
					</a>
				</div>
			</div>

			{#each groups as group (group.title)}
				<div>
					<p class="text-sm font-medium uppercase tracking-[0.22em] text-ink-muted">{group.title}</p>
					<ul class="mt-6 space-y-4">
						{#each group.links as link (link.label)}
							<li>
								<a
									href={link.href}
									target={link.external ? '_blank' : undefined}
									rel={link.external ? 'noreferrer' : undefined}
									class="group inline-flex items-center gap-1 text-base text-ink-body transition-colors hover:text-ink"
								>
									{link.label}
									{#if link.external}
										<IconArrowUpRight class="size-4 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>

		<div class="flex flex-col gap-6 pt-8 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<p class="text-sm text-ink-body">© {year} GlyphX. Local-first typesetting for serious writing.</p>
				<p class="mt-2 text-sm text-ink-muted">Desktop and web share one interface, one design language, and one set of controllable tokens.</p>
			</div>

			<div class="flex items-center gap-3">
				<a
					href={repo}
					target="_blank"
					rel="noreferrer"
					class="inline-flex size-10 items-center justify-center rounded-full border border-hairline bg-surface-card text-ink transition-colors hover:bg-surface-soft"
					aria-label="GitHub"
				>
					<IconBrandGithub class="size-4" />
				</a>
				<a
					href={`${repo}/releases`}
					target="_blank"
					rel="noreferrer"
					class="inline-flex size-10 items-center justify-center rounded-full border border-hairline bg-surface-card text-ink transition-colors hover:bg-surface-soft"
					aria-label="Releases"
				>
					<IconFileCode2 class="size-4" />
				</a>
			</div>
		</div>
	</div>
</footer>
