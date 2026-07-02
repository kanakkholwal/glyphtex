<script lang="ts">
	import { resolve } from '$app/paths';
	import { Logo } from '@glyphx/ui/logo';
	import { IconArrowUpRight, IconBrandGithub, IconFileCode2 } from '@tabler/icons-svelte';

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

	const legal: FooterLink[] = [
		{ label: 'Source code', href: repo, external: true },
		{ label: 'License', href: `${repo}/blob/main/LICENSE`, external: true },
		{ label: 'Changelog', href: `${repo}/releases`, external: true }
	];
</script>

<footer class="landing-footer border-t border-hairline bg-canvas">
	<div class="mx-auto max-w-7xl px-6 pb-32 pt-16 sm:pt-20 lg:px-10">
		<div class="grid gap-12 border-b border-hairline pb-12 lg:grid-cols-[1.5fr_0.75fr_0.75fr]">
			<div class="max-w-sm">
				<Logo href={home} size="lg" badge={false} tone="mono" class="text-ink" />
				<p class="mt-5 text-sm leading-7 text-ink-muted">
					GlyphX is local-first typesetting for serious writing — real LaTeX, real files, and
					control over where your work actually lives.
				</p>

				<div class="mt-6 flex items-center gap-2.5">
					<a
						href={repo}
						target="_blank"
						rel="noreferrer"
						class="inline-flex size-10 items-center justify-center rounded-full border border-hairline bg-surface-card text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
						aria-label="GitHub"
					>
						<IconBrandGithub class="size-[1.15rem]" />
					</a>
					<a
						href={`${repo}/releases`}
						target="_blank"
						rel="noreferrer"
						class="inline-flex size-10 items-center justify-center rounded-full border border-hairline bg-surface-card text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
						aria-label="Releases"
					>
						<IconFileCode2 class="size-[1.15rem]" />
					</a>
				</div>
			</div>

			{#each groups as group (group.title)}
				<div>
					<p class="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">{group.title}</p>
					<ul class="mt-5 space-y-3.5">
						{#each group.links as link (link.label)}
							<li>
								<a
									href={link.href}
									target={link.external ? '_blank' : undefined}
									rel={link.external ? 'noreferrer' : undefined}
									class="group inline-flex items-center gap-1 text-sm text-ink-body transition-colors hover:text-ink"
								>
									{link.label}
									{#if link.external}
										<IconArrowUpRight
											class="size-3.5 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
										/>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>

		<div class="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<p class="text-sm text-ink-muted">© {year} GlyphX · Local-first typesetting for serious writing.</p>
			<div class="flex flex-wrap items-center gap-x-6 gap-y-2">
				{#each legal as link (link.label)}
					<a
						href={link.href}
						target={link.external ? '_blank' : undefined}
						rel={link.external ? 'noreferrer' : undefined}
						class="text-sm text-ink-muted transition-colors hover:text-ink"
					>
						{link.label}
					</a>
				{/each}
			</div>
		</div>
	</div>

	<div class="landing-footer-dots" aria-hidden="true"></div>
</footer>
