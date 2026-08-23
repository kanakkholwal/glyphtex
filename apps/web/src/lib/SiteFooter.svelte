<script lang="ts">
	import { resolve } from "$app/paths";
	import type { ResolvedPathname } from "$app/types";
	import { track } from "$lib/analytics";
	import { footerCols, footerSocials } from "$lib/landing/nav-data";
	import { Logo } from "@glyphtex/ui/logo";
	import { IconBrandGithub, IconMail } from "@tabler/icons-svelte";

	const home = resolve("/");
	const year = new Date().getFullYear();

	const socialIcons = {
		GitHub: IconBrandGithub,
		Contact: IconMail
	} as const;

	const resolveAny = resolve as (route: string) => ResolvedPathname;

	function hrefFor(href: string, external = false): ResolvedPathname | string {
		if (external) return href as string;
		if (!href.startsWith("/") || href.startsWith("//")) return href as ResolvedPathname;
		return resolveAny(href);
	}
</script>

<footer class="bg-background">
	<div class="mx-auto w-full max-w-7xl px-6 pt-20 pb-12 sm:px-8 lg:px-10">
		<div class="grid gap-14 md:grid-cols-12">
			<div class="md:col-span-4">
				<a href={home} class="inline-flex items-center gap-2.5" aria-label="GlyphTeX home">
					<Logo size={32} badge tone="gradient" class="text-xl" />
				</a>

				<div class="mt-6 flex items-center gap-1">
					{#each footerSocials as social (social.label)}
						{@const Icon = socialIcons[social.label as keyof typeof socialIcons]}
						<a
							href={hrefFor(social.href, social.external)}
							aria-label={social.label}
							onclick={() =>
								track('outbound_clicked', {
									destination: social.label.toLowerCase(),
									location: 'footer'
								})}
							target={social.external ? '_blank' : undefined}
							rel={social.external ? 'noopener noreferrer' : undefined}
							class="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-soft hover:text-foreground"
						>
							<Icon class="size-4.5" />
						</a>
					{/each}
				</div>

				<p class="mt-8 max-w-xs text-sm leading-relaxed text-muted-foreground">
					A local-first LaTeX editor for academic writing. Plain .tex projects, compiled on your
					machine, versioned with Git.
				</p>

				<p class="mt-6 text-sm text-muted-foreground">
					© {year} GlyphTeX · GPLv3
				</p>
			</div>

			<div class="grid gap-10 sm:grid-cols-3 md:col-span-8">
				{#each footerCols as col (col.title)}
					<nav aria-label={col.title}>
						<p class="text-sm text-muted-foreground">{col.title}</p>
						<ul class="mt-4 space-y-3">
							{#each col.links as link (link.label)}
								<li>
									<a
										href={hrefFor(link.href, link.external)}
										target={link.external ? '_blank' : undefined}
										rel={link.external ? 'noopener noreferrer' : undefined}
										onclick={() =>
											link.external &&
											track('outbound_clicked', {
												destination: link.label.toLowerCase(),
												location: 'footer'
											})}
										class="text-base font-medium text-foreground transition-colors hover:text-foreground hover:underline"
									>
										{link.label}
									</a>
								</li>
							{/each}
						</ul>
					</nav>
				{/each}
			</div>
		</div>
	</div>
</footer>
