<script lang="ts">
	import { page } from "$app/state";
	import { absolute, DEFAULT_OG_IMAGE, SITE_NAME, SITE_TAGLINE } from "./site";

	type Props = {
		title: string;
		description: string;
		/** Overrides the current path. Set it when a page has a preferred URL. */
		canonical?: string;
		image?: string;
		type?: "website" | "article";
		noindex?: boolean;
		/** Pre-serialised JSON-LD blocks. */
		jsonld?: string[];
	};

	let {
		title,
		description,
		canonical,
		image = DEFAULT_OG_IMAGE,
		type = "website",
		noindex = false,
		jsonld = []
	}: Props = $props();

	const url = $derived(absolute(canonical ?? page.url.pathname));
	const fullTitle = $derived(title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`);
	const ogImage = $derived(absolute(image));
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	{#if noindex}
		<meta name="robots" content="noindex, follow" />
	{/if}

	<meta property="og:type" content={type} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:alt" content={SITE_TAGLINE} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />

	{#each jsonld as block, i (i)}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html `<script type="application/ld+json">${block}<\/script>`}
	{/each}
</svelte:head>
