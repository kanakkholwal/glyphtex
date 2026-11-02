<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import TemplateCard from "$lib/landing/TemplateCard.svelte";
	import { breadcrumbLd, serialise, templateLd } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow, Section, Well } from "$lib/site";
	import { templatePath, templatePreview } from "$lib/templates";
	import { Badge } from "@glyphtex/ui/badge";
	import { Button } from "@glyphtex/ui/button";
	import { CodeBlock } from "@glyphtex/ui/code-block";
	import { Image } from "@glyphtex/ui/image";
	import {
		IconArrowRight,
		IconDownload,
		IconExternalLink,
		IconTemplate
	} from "@tabler/icons-svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const resolveAny = resolve as (route: string) => string;
	const t = $derived(data.template);
	const original = $derived(t.origin === "glyphtex");
	const url = $derived(templatePath(t.id));
	const useHref = $derived(`${resolve("/workspace/templates")}?use=${encodeURIComponent(t.id)}`);
	const downloadHref = $derived(resolveAny(`/templates/${data.slug}.tex`));
	const downloadName = $derived(`${data.slug}.tex`);
	const preview = $derived(templatePreview(t.id));

	// "Simple Reflection Paper Template" would otherwise read "... Template LaTeX template".
	const heading = $derived(t.title.replace(/\s+template$/i, ""));
	const seoTitle = $derived(`${heading} LaTeX template`);
	const seoDescription = $derived(
		`Free ${heading} LaTeX template (${t.documentClass} class). ${t.description} Opens and compiles offline in your browser, no account.`
	);
	const licence = $derived(t.license.replace("Creative Commons ", ""));

	const steps = $derived([
		{
			title: "Open it in the editor",
			body: "The template becomes a new project in your browser. Nothing is uploaded and there is no account."
		},
		{
			title: "Replace the sample text",
			body: `Edit main.tex. The preview recompiles as you type, using the ${t.documentClass} class and the packages below.`
		},
		{
			title: "Export the PDF",
			body: "Download the PDF, or download the .tex and compile it with TeX Live, MiKTeX or any other LaTeX setup."
		}
	]);

	const facts = $derived([
		{ label: "Category", value: data.categoryLabel },
		{ label: "Document class", value: t.documentClass, mono: true },
		{ label: "Packages", value: String(data.packages.length), mono: true },
		{ label: "Author", value: t.author },
		{ label: "Licence", value: licence, href: t.licenseUrl },
		{ label: "Compiles", value: "Offline, in the browser" }
	]);

	const jsonld = $derived([
		serialise(
			templateLd({
				title: seoTitle,
				description: t.description,
				url,
				downloadUrl: `/templates/${data.slug}.tex`,
				author: t.author,
				original,
				license: t.licenseUrl,
				basedOn: original ? undefined : t.sourceUrl,
				packages: data.packages
			})
		),
		serialise(
			breadcrumbLd([
				{ name: "Home", url: "/" },
				{ name: "Templates", url: "/templates" },
				{ name: t.title, url }
			])
		)
	]);
</script>

<!-- Overleaf-sourced templates stay out of the index: their gallery page is the original. -->
<Seo title={seoTitle} description={seoDescription} canonical={url} noindex={!original} {jsonld} />

<RailFrame>
	<RailRow divider={false} label="Template" section="template_hero">
		<nav aria-label="Breadcrumb" class="rise font-mono text-xs text-muted-foreground">
			<ol class="flex flex-wrap items-center gap-1.5">
				<li>
					<a
						href={resolve('/templates')}
						class="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
					>
						Templates
					</a>
				</li>
				<li aria-hidden="true">/</li>
				<li>
					<a
						href="{resolve('/templates')}#{t.category}"
						class="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
					>
						{data.categoryLabel}
					</a>
				</li>
			</ol>
		</nav>
		<PageHero title={heading} accent="LaTeX template." lede={t.description}>
			{#snippet actions()}
				<Button
					href={useHref}
					variant="dark"
					onclick={() => track('cta_clicked', { target: 'template', location: 'template_page' })}
				>
					Open in the editor
					<IconArrowRight />
				</Button>
				<Button
					href={downloadHref}
					download={downloadName}
					variant="outline"
					onclick={() => track('download_clicked', { platform: 'tex', asset: downloadName, version: 'template' })}
				>
					<IconDownload />
					Download .tex
				</Button>
			{/snippet}
			{#snippet aside()}
				<Well bodyClass="bg-card p-6 sm:p-8 dark:bg-card">
					{#if preview}
						<Image
							src={preview.src}
							width={preview.width}
							height={preview.height}
							layout="constrained"
							alt="First page of the {t.title} template, compiled by GlyphTeX"
							loading="eager"
							fetchpriority="high"
							class="mx-auto block h-auto w-full max-w-md rounded-sm shadow-(--surface-shadow) ring-1 ring-border"
						/>
					{/if}
					{#snippet footer()}
						<p class="font-mono text-xs text-muted-foreground">
							{#if original}
								Compiled offline by GlyphTeX · public domain, no credit needed
							{:else}
								From the Overleaf gallery ·
								<a
									href={t.sourceUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-1 rounded-sm text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
								>
									original page <IconExternalLink class="size-3" aria-hidden="true" />
								</a>
							{/if}
						</p>
					{/snippet}
				</Well>
			{/snippet}
		</PageHero>
	</RailRow>

	<RailRow label="Template details" section="template_facts" class="py-0">
		<dl class="grid grid-cols-2 gap-x-10 sm:grid-cols-3 lg:grid-cols-6">
			{#each facts as f (f.label)}
				<div class="flex flex-col gap-1 border-t border-dashed border-border py-4">
					<dt class="font-mono text-xs text-muted-foreground">{f.label}</dt>
					<dd class={['text-sm text-foreground', f.mono && 'font-mono']}>
						{#if f.href}
							<a
								href={f.href}
								target="_blank"
								rel="noopener noreferrer"
								class="rounded-sm underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
							>
								{f.value}
							</a>
						{:else}
							{f.value}
						{/if}
					</dd>
				</div>
			{/each}
		</dl>
	</RailRow>

	<Section id="use" number={1} title="how to use it." section="template_steps">
		<ol class="grid gap-x-10 sm:grid-cols-3">
			{#each steps as step, i (step.title)}
				<li class="border-t border-dashed border-border py-5">
					<span class="font-mono text-xs text-muted-foreground tabular-nums">{String(i + 1).padStart(2, '0')}</span>
					<h3 class="mt-2 text-sm font-medium text-foreground">{step.title}</h3>
					<p class="mt-1 text-sm text-pretty text-muted-foreground">{step.body}</p>
				</li>
			{/each}
		</ol>
	</Section>

	{#if data.packages.length}
		<Section
			id="packages"
			number={2}
			title="packages it loads."
			description="Every one ships with the GlyphTeX engine, so the template compiles without installing anything."
			section="template_packages"
		>
			<ul class="flex flex-wrap gap-2" aria-label="LaTeX packages">
				{#each data.packages as name (name)}
					<li>
						{#if data.packagePages.includes(name)}
							<a
								href={resolveAny(`/packages/${name}`)}
								class="group/pkg block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<Badge
									variant="outline"
									class="font-mono font-normal transition-colors group-hover/pkg:bg-foreground/[0.06]"
								>
									{name}
								</Badge>
							</a>
						{:else}
							<Badge variant="outline" class="font-mono font-normal text-muted-foreground">
								{name}
							</Badge>
						{/if}
					</li>
				{/each}
			</ul>
		</Section>
	{/if}

	<Section
		id="source"
		number={data.packages.length ? 3 : 2}
		title="the source."
		description="The complete main.tex. Copy it, download it, or open it in the editor."
		section="template_source"
	>
		<CodeBlock code={data.source} language="latex" filename="main.tex" maxHeight="32rem" />
	</Section>

	{#if data.related.length}
		<Section
			id="related"
			number={data.packages.length ? 4 : 3}
			title="more {data.categoryLabel.toLowerCase()}."
			section="template_related"
		>
			{#snippet action()}
				<Button href="{resolve('/templates')}#{t.category}" variant="ghost" size="sm">
					All {data.categoryLabel.toLowerCase()}
					<IconArrowRight />
				</Button>
			{/snippet}
			<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Related templates">
				{#each data.related as r (r.id)}
					<TemplateCard template={r} location="template_related" />
				{/each}
			</ul>
		</Section>
	{/if}

	<RailRow label="Get started" section="template_cta">
		<BrandPanel
			title="Write it in your browser."
			body="Free, offline once loaded, and nothing leaves your device."
		>
			{#snippet icon()}
				<IconTemplate aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				<Button href={useHref} variant="dark">Open in the editor</Button>
				<Button href={resolve('/templates')} variant="outline">Browse all templates</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
