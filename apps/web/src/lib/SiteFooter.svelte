<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { Logo } from '@glyphtex/ui/logo';
	import { footerCols, footerSocials } from '$lib/landing/nav-data';
	import { IconBrandGithub, IconFileCode2, IconMail } from '@tabler/icons-svelte';

	const home = resolve('/');
	const year = new Date().getFullYear();

	const socialIcons = {
		GitHub: IconBrandGithub,
		Releases: IconFileCode2,
		Contact: IconMail
	} as const;

	const resolveAny = resolve as (route: string) => ResolvedPathname;

	function hrefFor(href: string, external = false): ResolvedPathname | string {
		if (external) return href as string;
		if (!href.startsWith('/') || href.startsWith('//')) return href as ResolvedPathname;
		return resolveAny(href);
	}
</script>

<footer class="relative overflow-hidden border-t border-hairline/70">
	<!-- Top hairline glow over the seam -->
	<div class="landing-bg-aurora absolute inset-x-0 top-0 z-10 h-px"></div>

	<!--
	  Editorial backdrop mirroring the hero: the photo sits in the lower half
	  and fades into the page background so the columns stay readable up top.
	  Different fade from HeroBackdrop (top-only dissolve, no bottom fade), so
	  the giant GlyphTeX wordmark below the columns stays on full-bleed photo.
	-->
	<div aria-hidden="true" class="pointer-events-none absolute inset-0">
		<div
			class="absolute inset-0 bg-cover bg-center opacity-90 dark:opacity-60"
			style="background-image: url('/background-footer.webp');"
		></div>
		<div
			class="absolute inset-0"
			style="background: linear-gradient(to bottom, var(--canvas) 0%, var(--canvas) 18%, transparent 52%);"
		></div>
	</div>

	<div
		class="relative z-10 mx-auto w-full max-w-7xl px-6 pt-20 pb-10 sm:px-8 md:pt-28 md:pb-14 lg:px-10"
	>
		<div class="grid gap-14 md:grid-cols-12">
			<div class="md:col-span-5">
				<a href={home} class="inline-flex items-center gap-2.5" aria-label="GlyphTeX home">
					<Logo size="md" badge tone="gradient" />
				</a>
				<p class="mt-6 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
					A local-first LaTeX editor for academic writing. Plain .tex projects, compiled on your
					machine, versioned with Git. GPLv3, free for individuals and institutions.
				</p>

				<div class="mt-7 flex items-center gap-2">
					{#each footerSocials as social (social.label)}
						{const Icon = socialIcons[social.label as keyof typeof socialIcons]}
						<a
							href={hrefFor(social.href, social.external)}
							aria-label={social.label}
							target={social.external ? '_blank' : undefined}
							rel={social.external ? 'noopener noreferrer' : undefined}
							class="landing-glass-chip grid size-9 place-items-center rounded-lg text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground"
						>
							<Icon class="size-4" />
						</a>
					{/each}
				</div>

				<p class="mt-7 text-xs text-muted-foreground">
					© {year} GlyphTeX · GPLv3. Local-first typesetting for serious writing.
				</p>
			</div>

			<div class="grid gap-10 sm:grid-cols-3 md:col-span-7">
				{#each footerCols as col (col.title)}
					<div>
						<h4 class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							{col.title}
						</h4>
						<ul class="mt-5 space-y-3.5">
							{#each col.links as link (link.label)}
								<li>
									<a
										href={hrefFor(link.href, link.external)}
										target={link.external ? '_blank' : undefined}
										rel={link.external ? 'noopener noreferrer' : undefined}
										class="text-sm font-medium text-foreground/75 transition-colors hover:text-foreground"
									>
										{link.label}
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Dedicated wordmark: a real in-flow band at the foot of the page (not an
	     absolutely positioned overlay), sitting over the full-bleed photo like
	     the trace-mvp footer. Leading is tightened so the band hugs the type. -->
	<div class="relative z-10 overflow-hidden px-4 pb-8 md:pb-12">
		<span class="landing-footer-wordmark">GlyphTeX</span>
	</div>
</footer>
