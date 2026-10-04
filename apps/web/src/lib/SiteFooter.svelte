<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import { footerCols, footerSocials } from "$lib/landing/nav-data";
	import { Button } from "@glyphtex/ui/button";
	import { Logo } from "@glyphtex/ui/logo";
	import { IconBrandGithub, IconBrandX, IconMail } from "@tabler/icons-svelte";

	const home = resolve("/");
	const year = new Date().getFullYear();
	const socialIcons = {
		GitHub: IconBrandGithub,
		Contact: IconMail,
		Twitter: IconBrandX
	} as const;

	const resolveAny = resolve as (route: string) => string;
	function hrefFor(href: string, external = false): string {
		if (external || !href.startsWith("/") || href.startsWith("//")) return href;
		return resolveAny(href);
	}
</script>

<footer class="border-t border-dashed border-border px-5 py-12 sm:px-6 lg:px-10">
	<div class="grid gap-10 md:grid-cols-6">
		<div class="flex flex-col items-start gap-4 md:col-span-2">
			<a
				href={home}
				class="flex w-fit items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label="GlyphTeX home"
			>
				<Logo size={24} badge class="text-base" />
			</a>
			<p class="max-w-xs text-sm text-pretty text-muted-foreground">
				A LaTeX editor that compiles on your machine. Plain .tex projects that open in any LaTeX
				tool, no account.
			</p>
			<div class="-ml-2 flex gap-0.5">
				{#each footerSocials as social (social.label)}
					{@const Icon = socialIcons[social.label as keyof typeof socialIcons]}
					<Button
						href={hrefFor(social.href, social.external)}
						target={social.external ? '_blank' : undefined}
						rel={social.external ? 'noopener noreferrer' : undefined}
						variant="ghost"
						size="icon-sm"
						aria-label={social.label}
						class="text-muted-foreground"
						onclick={() =>
							track('outbound_clicked', {
								destination: social.label.toLowerCase(),
								location: 'footer'
							})}
					>
						<Icon />
					</Button>
				{/each}
			</div>
		</div>

		<div class="grid grid-cols-2 gap-8 sm:grid-cols-4 md:col-span-4">
			{#each footerCols as col (col.title)}
				<nav class="flex flex-col gap-2" aria-label={col.title}>
					<h2 class="font-mono text-xs text-muted-foreground">{col.title.toLowerCase()}</h2>
					<ul class="flex flex-col">
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
									class="inline-flex min-h-8 items-center rounded-sm text-sm text-foreground outline-none transition-colors duration-(--duration-fast) hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
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

	<div
		class="mt-10 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-dashed border-border pt-5 font-mono text-xs text-muted-foreground"
	>
		<p>© {year} GlyphTeX · GPLv3</p>
		<p>Runs on your device. No account.</p>
	</div>
</footer>
