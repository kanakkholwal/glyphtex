<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import { REPO_URL } from "$lib/landing/nav-data";
	import { breadcrumbLd, faqLd, libraryLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, PageHero, RailFrame, RailRow, Section, Well } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { CodeBlock } from "@glyphtex/ui/code-block";
	import { IconArrowRight, IconBrandGithub, IconCode } from "@tabler/icons-svelte";
	import enginePackage from "glyphtex-engine/package.json";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	// The crate and the npm package are released together from one tag, so they share a version.
	const version = enginePackage.version;
	const resolveAny = resolve as (route: string) => string;

	const libraries = [
		{
			id: "glyphtex-engine",
			name: "glyphtex-engine",
			kind: "npm · JavaScript and TypeScript",
			language: "TypeScript",
			summary:
				"Compile LaTeX to PDF in the browser or in Node. Tectonic's XeTeX compiled to WebAssembly, with the TeX bundle and package sets inside the package.",
			install: "npm install glyphtex-engine",
			installLang: "bash",
			registry: "https://www.npmjs.com/package/glyphtex-engine",
			registryLabel: "npm",
			repository: `${REPO_URL}/tree/main/packages/tex-engine`,
			sample: [
				'import { TexEngine, unpackTarGz } from "glyphtex-engine";',
				"",
				"const engine = await TexEngine.load(wasmBytes);",
				"engine.addFiles(await unpackTarGz(bundleBytes));",
				'engine.addFile("main.tex", source);',
				"",
				'const result = engine.compile({ entry: "main.tex" });',
				'if (result.status !== "failed") save(engine.pdf());'
			].join("\n")
		},
		{
			id: "glyphtex-tex-api",
			name: "glyphtex-tex-api",
			kind: "crates.io · Rust",
			language: "Rust",
			summary:
				"Parse TeX logs into errors and warnings with file and line, and speak the engine's typed JSON contract from Rust. No C dependencies.",
			install: "cargo add glyphtex-tex-api",
			installLang: "bash",
			registry: "https://crates.io/crates/glyphtex-tex-api",
			registryLabel: "crates.io",
			repository: `${REPO_URL}/tree/main/crates/glyphtex-tex-api`,
			sample: [
				"use glyphtex_tex_api::{parse_log, Severity};",
				"",
				'let log = std::fs::read_to_string("main.log")?;',
				"for d in parse_log(&log) {",
				"    if d.severity == Severity::Error {",
				'        eprintln!("{:?}:{:?} {}", d.file, d.line, d.message);',
				"    }",
				"}"
			].join("\n")
		}
	] as const;

	const uses = [
		{
			title: "LaTeX in your web app",
			body: "A live preview for a CMS, a course platform or a note-taking app, compiled in the reader's browser with nothing sent to a server."
		},
		{
			title: "PDFs from Node",
			body: "Reports, invoices or certificates typeset with LaTeX in a Node service or a build step, without installing TeX Live in the image."
		},
		{
			title: "LaTeX checks in CI",
			body: "Parse the log of any TeX build and fail the job, or annotate the pull request, when a document has errors."
		}
	];

	const faqs = [
		{
			q: "Can I compile LaTeX in the browser with JavaScript?",
			a: "Yes. glyphtex-engine is Tectonic's XeTeX compiled to WebAssembly. Install it from npm, load the engine and its TeX bundle, add your .tex files and call compile(); it returns the PDF bytes and structured diagnostics."
		},
		{
			q: "Is there a Rust library for parsing LaTeX logs?",
			a: "glyphtex-tex-api parses TeX logs from any engine into diagnostics with severity, file, line and message, and defines the GlyphTeX engine's request and result types with serde."
		}
	];

	const jsonld = [
		...libraries.map((l) =>
			serialise(
				libraryLd({
					name: l.name,
					description: l.summary,
					url: `/developers/${l.id}`,
					language: l.language,
					registry: l.registry,
					repository: l.repository,
					license: "https://opensource.org/licenses/MIT",
					version
				})
			)
		),
		serialise(faqLd(faqs)!),
		serialise(
			breadcrumbLd([
				{ name: "Home", url: "/" },
				{ name: "Developers", url: "/developers" }
			])
		)
	];
</script>

<Seo
	title="Compile LaTeX in JavaScript and Rust · GlyphTeX for developers"
	description="Open source libraries behind GlyphTeX: glyphtex-engine compiles LaTeX to PDF in the browser or Node via WebAssembly, and glyphtex-tex-api parses TeX logs in Rust."
	canonical="/developers"
	{jsonld}
/>

<RailFrame>
	<RailRow divider={false} label="Developers" section="developers_hero">
		<PageHero
			badge="Open source · MIT · v{version}"
			title="Compile LaTeX"
			accent="in JavaScript and Rust."
			lede="The engine behind GlyphTeX is two libraries you can use in your own projects: a WebAssembly TeX compiler for the browser and Node, and a Rust crate for TeX logs and the engine's types."
		>
			{#snippet actions()}
				<Button href={resolveAny("/developers/glyphtex-engine")} variant="dark">
					JavaScript guide
					<IconArrowRight />
				</Button>
				<Button href={resolveAny("/developers/glyphtex-tex-api")} variant="outline">
					Rust guide
				</Button>
			{/snippet}
		</PageHero>
	</RailRow>

	<Section id="libraries" number={1} title="the libraries." section="developers_libraries">
		<div class="grid gap-4 lg:grid-cols-2">
			{#each libraries as l (l.id)}
				<Well bodyClass="flex h-full flex-col gap-5 p-6">
					<div class="flex flex-col gap-1.5">
						<p class="font-mono text-xs text-muted-foreground">{l.kind}</p>
						<h3 class="font-mono text-lg text-foreground">{l.name}</h3>
						<p class="text-sm text-pretty text-muted-foreground">{l.summary}</p>
					</div>
					<CodeBlock code={l.install} language={l.installLang} />
					<CodeBlock code={l.sample} language={l.language === "Rust" ? "rust" : "ts"} />
					<div class="mt-auto flex flex-wrap gap-2">
						<Button href={resolveAny(`/developers/${l.id}`)} variant="dark" size="sm">Guide</Button>
						<Button href={resolveAny(`/developers/${l.id}/examples`)} variant="outline" size="sm">
							Examples
						</Button>
						<Button href={resolveAny(`/developers/${l.id}/api`)} variant="outline" size="sm">
							API reference
						</Button>
						<Button
							href={l.registry}
							target="_blank"
							rel="noopener noreferrer"
							variant="ghost"
							size="sm"
							onclick={() => track("outbound_clicked", { destination: l.registryLabel, location: "developers" })}
						>
							{l.registryLabel}
						</Button>
					</div>
				</Well>
			{/each}
		</div>
	</Section>

	<Section id="uses" number={2} title="what you can build." section="developers_uses">
		<ul class="grid gap-x-10 sm:grid-cols-3">
			{#each uses as u (u.title)}
				<li class="border-t border-dashed border-border py-5">
					<h3 class="text-sm font-medium text-foreground">{u.title}</h3>
					<p class="mt-1 text-sm text-pretty text-muted-foreground">{u.body}</p>
				</li>
			{/each}
		</ul>
	</Section>

	<Section id="all" number={3} title="every page." section="developers_pages">
		<div class="grid gap-x-10 sm:grid-cols-2">
			{#each data.groups as g (g.category)}
				<div class="flex flex-col">
					<h3 class="mb-2 font-mono text-xs text-muted-foreground">{g.category}</h3>
					<ul class="group/list flex flex-col">
						{#each g.items as item (item.url)}
							<li>
								<a
									href={resolveAny(item.url)}
									class="flex flex-col gap-1 border-t border-dashed border-border py-4 outline-none transition-opacity duration-(--duration-fast) group-hover/list:opacity-50 hover:opacity-100! focus-visible:opacity-100! focus-visible:ring-2 focus-visible:ring-ring"
								>
									<span class="text-sm font-medium text-foreground">{item.title}</span>
									<span class="line-clamp-2 text-sm text-pretty text-muted-foreground">
										{item.description}
									</span>
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</Section>

	<RailRow label="Source" section="developers_cta">
		<BrandPanel
			title="Built in the open."
			body="Both libraries live in the GlyphTeX repository, with the editor that uses them. Issues and pull requests welcome."
		>
			{#snippet icon()}
				<IconCode aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				<Button href={REPO_URL} target="_blank" rel="noopener noreferrer" variant="dark">
					<IconBrandGithub />
					GitHub
				</Button>
				<Button href={resolve("/engine")} variant="outline">How the engine works</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
