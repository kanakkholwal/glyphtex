<script lang="ts">
	import { resolve } from "$app/paths";
	import TemplateCard from "$lib/landing/TemplateCard.svelte";
	import { articleLd, breadcrumbLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow, Section } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { CodeBlock } from "@glyphtex/ui/code-block";
	import { packageRequestUrl, REQUEST_ETA } from "$lib/packages/request";
	import { IconArrowRight, IconBrandGithub, IconPackage } from "@tabler/icons-svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const url = $derived(`/packages/${data.name}`);
	const load = $derived(`\\usepackage{${data.name}}`);
	const sample = $derived(
		[
			"\\documentclass{article}",
			load,
			"",
			"\\begin{document}",
			...(data.commands[0] ? [`% ${data.commands[0].detail}`, data.commands[0].syntax] : []),
			...(data.environments[0]
				? [
						`% ${data.environments[0].detail}`,
						`\\begin{${data.environments[0].name}}`,
						"  …",
						`\\end{${data.environments[0].name}}`
					]
				: []),
			"\\end{document}"
		].join("\n")
	);

	const summary = $derived(
		[
			data.coverage.commands && `${data.coverage.commands} commands`,
			data.coverage.environments && `${data.coverage.environments} environments`
		]
			.filter(Boolean)
			.join(" and ")
	);
	const answer = $derived(
		`${data.detail}. Load it with ${load} in the preamble.` +
			(summary ? ` It adds ${summary}.` : "") +
			(data.templates.length
				? ` ${data.templates.length} GlyphTeX ${data.templates.length === 1 ? "template uses" : "templates use"} it, and each compiles offline.`
				: "")
	);
	const description = $derived(
		`The ${data.name} LaTeX package: ${data.detail.charAt(0).toLowerCase()}${data.detail.slice(1)}. How to load it, what it adds, and templates that use it.`
	);

	const supportLine = $derived(
		data.support?.kind === "core"
			? "Built into GlyphTeX"
			: data.support?.kind === "pack"
				? `In the ${data.support.packLabel} package set`
				: `Not in GlyphTeX yet · requests usually ship in ${REQUEST_ETA}`
	);

	const numbers = $derived.by(() => {
		let n = 0;
		return {
			commands: data.commands.length ? ++n : 0,
			environments: data.environments.length ? ++n : 0,
			templates: data.templates.length ? ++n : 0
		};
	});

	const jsonld = $derived([
		serialise(
			articleLd({
				type: "TechArticle",
				title: `The ${data.name} LaTeX package`,
				description,
				url,
				tags: ["latex", data.name]
			})
		),
		serialise(
			breadcrumbLd([
				{ name: "Home", url: "/" },
				{ name: "LaTeX packages", url: "/packages" },
				{ name: data.name, url }
			])
		)
	]);
</script>

<Seo title="{data.name} LaTeX package" {description} canonical={url} type="article" {jsonld} />

<RailFrame>
	<RailRow divider={false} label="LaTeX package" section="package_hero">
		<nav aria-label="Breadcrumb" class="rise font-mono text-xs text-muted-foreground">
			<ol class="flex flex-wrap items-center gap-1.5">
				<li>
					<a
						href={resolve('/packages')}
						class="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
					>
						Packages
					</a>
				</li>
				<li aria-hidden="true">/</li>
				<li class="text-foreground">{data.name}</li>
			</ol>
		</nav>
		<PageHero badge={supportLine} title={data.name} accent="LaTeX package." lede={answer}>
			{#snippet actions()}
				{#if data.support}
					<Button href={resolve('/workspace')} variant="dark">
						Try it in the editor
						<IconArrowRight />
					</Button>
				{:else}
					<Button
						href={packageRequestUrl(data.name)}
						target="_blank"
						rel="noopener noreferrer"
						variant="dark"
					>
						<IconBrandGithub />
						Request {data.name}
					</Button>
				{/if}
				{#if data.templates.length}
					<Button href="#templates" variant="outline">Templates that use it</Button>
				{/if}
			{/snippet}
			{#snippet aside()}
				<CodeBlock code={sample} language="latex" filename="main.tex" />
			{/snippet}
		</PageHero>
	</RailRow>

	{#if data.commands.length}
		<Section
			id="commands"
			number={numbers.commands}
			title="commands it adds."
			description="As the editor completes them; … marks an argument."
			section="package_commands"
		>
			<dl class="grid gap-x-10 sm:grid-cols-2">
				{#each data.commands as c (c.name)}
					<div class="flex flex-col gap-1 border-t border-dashed border-border py-4">
						<dt class="font-mono text-sm text-foreground">{c.syntax}</dt>
						<dd class="text-sm text-pretty text-muted-foreground">
							{c.detail}{#if c.context === 'math'}<span class="font-mono text-xs"> · math mode</span>{/if}
						</dd>
					</div>
				{/each}
			</dl>
		</Section>
	{/if}

	{#if data.environments.length}
		<Section id="environments" number={numbers.environments} title="environments it adds." section="package_envs">
			<dl class="grid gap-x-10 sm:grid-cols-2">
				{#each data.environments as e (e.name)}
					<div class="flex flex-col gap-1 border-t border-dashed border-border py-4">
						<dt class="font-mono text-sm text-foreground">{e.syntax}</dt>
						<dd class="text-sm text-pretty text-muted-foreground">
							{e.detail}{#if e.context === 'math'}<span class="font-mono text-xs"> · math</span>{/if}
						</dd>
					</div>
				{/each}
			</dl>
		</Section>
	{/if}

	{#if data.templates.length}
		<Section
			id="templates"
			number={numbers.templates}
			title="templates that use it."
			description="Each one loads {data.name} and compiles offline in GlyphTeX."
			section="package_templates"
		>
			<ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Templates using {data.name}">
				{#each data.templates.slice(0, 6) as t (t.id)}
					<TemplateCard template={t} location="package_page" />
				{/each}
			</ul>
		</Section>
	{/if}

	<RailRow label="More packages" section="package_cta">
		<BrandPanel
			title="Looking for another package?"
			body="The reference lists every package the editor knows, with what each one is for."
		>
			{#snippet icon()}
				<IconPackage aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				<Button href={resolve('/packages')} variant="dark">All packages</Button>
				<Button href={resolve('/templates')} variant="outline">Browse templates</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
