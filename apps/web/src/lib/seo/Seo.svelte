<script lang="ts">
	import { page } from "$app/state";
	import { absolute, AUTHOR, DEFAULT_OG_IMAGE, SITE_NAME, SITE_TAGLINE } from "./site";

	type Props = {
		title: string;
		description: string;
		/** Overrides the current path. Set it when a page has a preferred URL. */
		canonical?: string;
		image?: string;
		imageAlt?: string;
		type?: "website" | "article";
		noindex?: boolean;
		/** Article-only Open Graph fields. */
		published?: string;
		modified?: string;
		section?: string;
		tags?: readonly string[];
		authorName?: string;
		/** Pre-serialised JSON-LD blocks. */
		jsonld?: string[];
	};

	let {
		title,
		description,
		canonical,
		image = DEFAULT_OG_IMAGE,
		imageAlt,
		type = "website",
		noindex = false,
		published,
		modified,
		section,
		tags = [],
		authorName = AUTHOR.name,
		jsonld = []
	}: Props = $props();

	const url = $derived(absolute(canonical ?? page.url.pathname));
	const fullTitle = $derived(title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`);
	const ogImage = $derived(absolute(image));
	const ogImageAlt = $derived(imageAlt ?? SITE_TAGLINE);
	// Full snippets and large image previews in Google and AI answer engines.
	const robots = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
	// x.com handle without the URL, for Twitter attribution.
	const twitterHandle = "@kanakkholwal";
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	<meta name="robots" content={noindex ? "noindex, follow" : robots} />
	<link rel="alternate" hreflang="en" href={url} />
	<link rel="alternate" hreflang="x-default" href={url} />

	<meta property="og:type" content={type} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content="en_GB" />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:alt" content={ogImageAlt} />

	{#if type === "article"}
		{#if published}<meta property="article:published_time" content={published} />{/if}
		{#if modified}<meta property="article:modified_time" content={modified} />{/if}
		{#if section}<meta property="article:section" content={section} />{/if}
		<meta property="article:author" content={authorName} />
		{#each tags as tag (tag)}
			<meta property="article:tag" content={tag} />
		{/each}
	{/if}

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:site" content={twitterHandle} />
	<meta name="twitter:creator" content={twitterHandle} />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />
	<meta name="twitter:image:alt" content={ogImageAlt} />

	{#each jsonld as block, i (i)}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html `<script type="application/ld+json">${block}<\/script>`}
	{/each}
</svelte:head>
