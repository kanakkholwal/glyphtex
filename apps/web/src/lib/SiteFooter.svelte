<script lang="ts">
	import { resolve } from "$app/paths";
	import type { ResolvedPathname } from "$app/types";
	import { track } from "$lib/analytics";
	import { footerCols, footerSocials } from "$lib/landing/nav-data";
	import { Button } from "@glyphtex/ui/button";
	import { Logo } from "@glyphtex/ui/logo";
	import { IconBrandGithub, IconMail, IconBrandX } from "@tabler/icons-svelte";

	const home = resolve("/");
	const year = new Date().getFullYear();

	const socialIcons = {
		GitHub: IconBrandGithub,
		Contact: IconMail,
		Twitter: IconBrandX
	} as const;

	const resolveAny = resolve as (route: string) => ResolvedPathname;

	function hrefFor(href: string, external = false): ResolvedPathname | string {
		if (external) return href as string;
		if (!href.startsWith("/") || href.startsWith("//")) return href as ResolvedPathname;
		return resolveAny(href);
	}

	let spot = $state({ x: 50, y: 50, on: false });

	function follow(e: PointerEvent) {
		if (e.pointerType !== "mouse") return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		spot = {
			x: ((e.clientX - rect.left) / rect.width) * 100,
			y: ((e.clientY - rect.top) / rect.height) * 100,
			on: true
		};
	}
</script>

{#snippet wordmark(className: string)}
	<svg viewBox="0 0 1000 220" class="block h-auto w-full font-display {className}">
		<text
			x="500"
			y="190"
			text-anchor="middle"
			textLength="990"
			lengthAdjust="spacingAndGlyphs"
			font-size="230"
			font-weight="700"
		>
			GLYPHTEX
		</text>
	</svg>
{/snippet}

<div aria-hidden="true" class="rail-dash w-full border-t-2"></div>

<footer class="rail-column mx-auto px-3 py-10 sm:px-6 sm:py-14">
	<div class="rounded-3xl border border-border bg-card px-6 py-8 sm:px-10 sm:py-10 dark:bg-background">
		<div class="grid gap-10 md:grid-cols-6">
			<div class="flex flex-col items-start gap-4 md:col-span-2">
				<a
					href={home}
					class="flex w-fit items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
					aria-label="GlyphTeX home"
				>
					<Logo size={28} badge class="text-subheading" />
				</a>
				<p class="max-w-xs text-pretty text-body leading-relaxed text-muted-foreground">
					A local-first LaTeX editor for academic writing. Plain .tex projects, compiled on your
					machine, versioned with Git.
				</p>
				<div class="flex gap-1">
					{#each footerSocials as social (social.label)}
						{@const Icon = socialIcons[social.label as keyof typeof socialIcons]}
						<Button
							href={hrefFor(social.href, social.external)}
							target={social.external ? '_blank' : undefined}
							rel={social.external ? 'noopener noreferrer' : undefined}
							variant="ghost"
							size="icon"
							aria-label={social.label}
							class="text-muted-foreground hover:text-foreground"
							onclick={() =>
								track('outbound_clicked', {
									destination: social.label.toLowerCase(),
									location: 'footer'
								})}
						>
							<Icon class="size-5" />
						</Button>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-8 sm:grid-cols-4 md:col-span-4">
				{#each footerCols as col (col.title)}
					<nav class="flex flex-col gap-3" aria-label={col.title}>
						<h2 class="text-caption font-semibold text-foreground">{col.title}</h2>
						<ul class="flex flex-col gap-1">
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
										class="inline-flex min-h-8 items-center rounded-sm text-body text-muted-foreground outline-none transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
			class="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-border pt-5 text-caption text-muted-foreground"
		>
			<p>© {year} GlyphTeX · GPLv3</p>
			<p>Runs on your device. No account.</p>
		</div>
	</div>

	<div
		aria-hidden="true"
		class="relative mt-6 select-none"
		onpointermove={follow}
		onpointerleave={() => (spot.on = false)}
	>
		{@render wordmark('wordmark-base')}
		<div
			class="absolute inset-0 transition-opacity duration-300"
			style:opacity={spot.on ? 1 : 0}
			style:mask-image={`radial-gradient(circle 10rem at ${spot.x}% ${spot.y}%, black, transparent)`}
			style:-webkit-mask-image={`radial-gradient(circle 10rem at ${spot.x}% ${spot.y}%, black, transparent)`}
		>
			{@render wordmark('fill-primary')}
		</div>
	</div>
</footer>

<style>
	.wordmark-base :global(text) {
		fill: color-mix(in oklch, var(--foreground) 5%, transparent);
	}
</style>
