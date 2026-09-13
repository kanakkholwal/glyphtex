<script lang="ts">
	import { AUTHOR } from "$lib/seo/site";
	import { IconBrandGithub, IconBrandLinkedin, IconBrandX } from "@tabler/icons-svelte";

	const links = [
		{ icon: IconBrandGithub, href: AUTHOR.sameAs[0], label: "GitHub" },
		{ icon: IconBrandX, href: AUTHOR.sameAs[1], label: "X" },
		{ icon: IconBrandLinkedin, href: AUTHOR.sameAs[2], label: "LinkedIn" }
	];
</script>

<aside aria-label="About the author" class="panel-card flex gap-4 p-5 sm:p-6">
	<!-- SVG avatar: @unpic/svelte is for raster images. -->
	<img
		src={AUTHOR.avatar}
		alt=""
		width="52"
		height="52"
		loading="lazy"
		class="size-13 shrink-0 rounded-full border border-border object-cover"
	/>
	<div class="flex min-w-0 flex-col">
		<a
			href="/about"
			class="w-fit rounded-sm text-body-lg font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
		>
			{AUTHOR.name}
		</a>
		<p class="text-caption text-muted-foreground">{AUTHOR.role}</p>
		<p class="mt-2 max-w-prose text-pretty text-body text-muted-foreground">{AUTHOR.bio}</p>
		<div class="mt-2 -ml-2.5 flex">
			{#each links as link (link.label)}
				<a
					href={link.href}
					target="_blank"
					rel="noopener noreferrer"
					aria-label="{AUTHOR.name} on {link.label}"
					class="grid size-10 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
				>
					<link.icon class="size-4" aria-hidden="true" />
				</a>
			{/each}
		</div>
	</div>
</aside>
