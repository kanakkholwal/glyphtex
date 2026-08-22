<script lang="ts">
	import { AUTHOR } from "$lib/seo/site";
	import { IconBrandGithub, IconBrandLinkedin, IconBrandX } from "@tabler/icons-svelte";

	const links = [
		{ icon: IconBrandGithub, href: AUTHOR.sameAs[0], label: "GitHub" },
		{ icon: IconBrandX, href: AUTHOR.sameAs[1], label: "X" },
		{ icon: IconBrandLinkedin, href: AUTHOR.sameAs[2], label: "LinkedIn" }
	];
</script>

<aside class="flex gap-4 rounded-2xl border border-hairline bg-surface-soft px-6 py-6">
	<img
		src={AUTHOR.avatar}
		alt={AUTHOR.name}
		width="52"
		height="52"
		loading="lazy"
		class="size-13 shrink-0 rounded-full border border-hairline object-cover"
	/>
	<div>
		<a
			href="/about"
			class="text-sm font-semibold tracking-tight text-foreground hover:underline"
			>{AUTHOR.name}</a
		>
		<p class="text-xs text-muted-foreground">{AUTHOR.role}</p>
		<p class="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{AUTHOR.bio}</p>
		<div class="mt-3 flex gap-3">
			{#each links as link (link.label)}
				<a
					href={link.href}
					target="_blank"
					rel="noopener"
					aria-label={link.label}
					class="text-muted-foreground transition-colors hover:text-foreground"
				>
					<link.icon class="size-4" stroke-width={1.75} />
				</a>
			{/each}
		</div>
	</div>
</aside>
