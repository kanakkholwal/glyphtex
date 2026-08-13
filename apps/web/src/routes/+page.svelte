<script lang="ts">
	import { resolve } from '$app/paths';
	import { track } from '$lib/analytics';
	import { Container, ContainerTextFlip, Section, ShowcasePanel } from '$lib/landing';
	import EditorMock from '$lib/landing/EditorMock.svelte';
	import { CONTACT_EMAIL } from '$lib/landing/nav-data';
	import PolishGrid from '$lib/landing/PolishGrid.svelte';
	import { techLogos } from '$lib/landing/tech-logos';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import SiteHeader from '$lib/SiteHeader.svelte';
	import { Button } from '@glyphtex/ui/button';
	import { Reveal } from '@glyphtex/ui/reveal';
	import { SectionHeader } from '@glyphtex/ui/section-header';
	import {
		IconArrowRight,
		IconBook2,
		IconBrandGithub,
		IconBrowser,
		IconCheck,
		IconClock,
		IconCloudOff,
		IconDeviceDesktop,
		IconFileText,
		IconFolders,
		IconGitBranch,
		IconHistory,
		IconInfinity,
		IconLicense,
		IconLock,
		IconMail,
		IconMinus,
		IconPackageExport,
		IconPlus,
		IconSchool,
		IconSearch,
		IconServer,
		IconShield,
		IconShieldLock,
		IconStack3,
		IconUserOff,
		IconUsersGroup,
		IconWriting
	} from '@tabler/icons-svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly, slide } from 'svelte/transition';

	const repo = 'https://github.com/kanakkholwal/glyphtex';
	const CTA_LABEL = 'Open the workspace';
	const workspace = resolve('/workspace');

	const rotatingWords = ['thesis.', 'paper.', 'manuscript.', 'lecture notes.'];

	const reducedMotion =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	const heroAssurances = [
		{ icon: IconInfinity, label: 'Free forever' },
		{ icon: IconUserOff, label: 'No account' },
		{ icon: IconBrowser, label: 'Runs in your browser' },
		{ icon: IconLock, label: 'Files stay on your device' }
	];

	const openSourceClaims = [
		{ icon: IconBrandGithub, label: 'GPLv3 open source' },
		{ icon: IconGitBranch, label: 'Plain .tex under plain Git' },
		{ icon: IconCloudOff, label: 'Compiles with the network off' }
	];

	type PainPoint = { id: string; title: string; description: string; icon: typeof IconClock };

	const painPoints: PainPoint[] = [
		{
			id: 'queue',
			title: 'Compile queue times out before the build finishes.',
			description:
				'A 30-second build becomes a 4-minute wait when the shared queue is busy. The deadline does not care.',
			icon: IconClock
		},
		{
			id: 'license',
			title: 'Per-seat licensing blocks the whole lab from editing.',
			description:
				'Procurement caps the seat count. The undergrad who needs to proofread gets locked out.',
			icon: IconLock
		},
		{
			id: 'privacy',
			title: 'Unpublished drafts sit on a third-party server.',
			description: 'Submission-ready manuscripts leave traces somewhere you do not control.',
			icon: IconShield
		},
		{
			id: 'history',
			title: 'Full history is locked behind the paid tier.',
			description:
				'Free plans cap revisions. The paper you wrote last year has its diffs paywalled.',
			icon: IconHistory
		}
	];

	const solutions = [
		'Compile on your machine, instantly. No queue, no limits.',
		'Free for everyone, forever. No subscriptions, no per-seat fees.',
		'Your drafts stay on your own disk. Every revision is tracked.',
		'Open a browser tab and write. Nothing to install, no account.'
	];

	const polishFeatures = [
		{
			icon: IconWriting,
			title: 'Auto-compile on save',
			description:
				'The PDF rebuilds as you type. You stop writing and the next page is already there.'
		},
		{
			icon: IconStack3,
			title: 'Live preview beside source',
			description:
				'Editor on the left, rendered PDF on the right. Errors land next to the line that caused them.'
		},
		{
			icon: IconFileText,
			title: 'Bibliographies that build',
			description:
				'BibTeX runs inside the engine, so \\bibliography and biblatex resolve into a real reference list offline. Only Biber needs the desktop app.'
		},
		{
			icon: IconSearch,
			title: 'Project-wide find',
			description:
				'A single keystroke searches every .tex and .bib in the project. Live, with file previews.'
		}
	];

	const openSources = [
		{
			icon: IconFileText,
			title: 'Overleaf export',
			description: 'Drag the .zip from Overleaf into GlyphTeX. The folder structure stays intact.'
		},
		{
			icon: IconGitBranch,
			title: 'Git repository',
			description:
				'Point GlyphTeX at an existing repo. Pulls, pushes, and history work as expected.'
		},
		{
			icon: IconFolders,
			title: 'Plain .tex folder',
			description: 'A directory of chapters, figures, and a .bib. Open it and start writing.'
		}
	];

	const trackFeatures = [
		{
			icon: IconGitBranch,
			title: 'Built-in Git UI',
			description: 'Stage, commit, branch, and merge without leaving the editor.'
		},
		{
			icon: IconLock,
			title: 'No proprietary history tier',
			description: 'Every revision, forever. The repository is the source of truth.'
		},
		{
			icon: IconBrandGithub,
			title: 'Works with your remote',
			description: 'GitHub, GitLab, a self-hosted Gitea, or your university server.'
		}
	];

	const commits = [
		{ msg: 'Final revisions · chapter 5', hash: 'c7d8e9f', when: 'today' },
		{ msg: 'Add citation · Smith 2024', hash: 'e4f5a6b', when: '2 days ago' },
		{ msg: 'Draft · conclusion', hash: 'a1b2c3d', when: 'last week' },
		{ msg: 'Fix typo · section 3.2', hash: '9f8e7d6', when: 'last month' }
	];

	const audienceCards = [
		{
			icon: IconBook2,
			title: 'PhD students',
			body: 'Thesis drafts that compile every time. Write on a plane. Submit from your own machine. Keep every revision for the viva defence.'
		},
		{
			icon: IconSchool,
			title: 'Professors and lecturers',
			body: 'Course notes, handouts, and lab manuals that stay versioned across semesters. Hand the source to a TA and they can edit it locally.'
		},
		{
			icon: IconUsersGroup,
			title: 'Research groups',
			body: 'A shared repo, individual commits, and one source of truth for the manuscript. No shared Google Doc with a half-written equation.'
		}
	];

	const institutionCards = [
		{
			icon: IconLicense,
			title: 'No licence server, no renewal',
			body: 'GPLv3. Nothing to procure, no seats to reconcile at the end of term.'
		},
		{
			icon: IconShieldLock,
			title: 'Nothing leaves the device',
			body: 'Drafts compile locally. No vendor holds the data, so there is no processor to assess.'
		},
		{
			icon: IconDeviceDesktop,
			title: 'Runs on managed machines',
			body: 'The browser workspace needs no install and no admin rights. Lab images stay as IT built them.'
		},
		{
			icon: IconSchool,
			title: 'Ready for a whole cohort',
			body: 'Hand out a template repo and students start writing. No accounts to provision or revoke.'
		},
		{
			icon: IconPackageExport,
			title: 'Archival by default',
			body: 'Plain .tex and .bib under Git. A thesis submitted this year still opens in ten.'
		},
		{
			icon: IconServer,
			title: 'Self-host the moving parts',
			body: 'Point the Git proxy at your own host so pushes stay inside the university network.'
		}
	];

	const institutionStats = [
		{ value: '$0', label: 'per seat, per year' },
		{ value: '0', label: 'accounts to provision' },
		{ value: 'GPLv3', label: 'licence review, once' }
	];

	// Prefilled so the first reply already carries the details we need to answer.
	const institutionMailto = `${CONTACT_EMAIL}?subject=${encodeURIComponent(
		'GlyphTeX for our department'
	)}&body=${encodeURIComponent(
		'Institution:\nDepartment:\nRough number of writers:\nWhat IT needs to sign off on:\n'
	)}`;

	type Faq = { q: string; a: string };
	const faqs: Faq[] = [
		{
			q: 'Can I bring my Overleaf project into GlyphTeX?',
			a: 'Yes. Export from Overleaf as a .zip and drop it into the workspace. The source stays plain .tex and .bib files; nothing is reshaped, and you can export the folder again at any time.'
		},
		{
			q: 'Does GlyphTeX support biblatex and biber?',
			a: 'BibTeX is compiled into the engine, so \\bibliography and biblatex with backend=bibtex build a real reference list offline. Biber is the exception: a Perl program with no WebAssembly build, so it needs the desktop app. The browser names the one line that fixes it rather than rendering every citation as [?].'
		},
		{
			q: 'Will it handle a 300-page thesis?',
			a: 'Yes. Projects split across chapters and includes, and the outline panel mirrors the structure. Compiling happens on your own hardware, so the only practical limit is your machine.'
		},
		{
			q: 'Can my students use it without paying?',
			a: 'Yes. GlyphTeX is GPLv3 open source with no paid tier. There is no seat to count and no licence server to phone home. Your department can deploy it on every lab machine.'
		},
		{
			q: 'Does it work offline?',
			a: 'Yes. The workspace downloads the engine once, then compiles in the tab with no network at all. Your files live in browser storage on your own device; nothing uploads.'
		},
		{
			q: 'How do collaborators share a manuscript?',
			a: 'Through Git. Stage, commit, browse history, and push to GitHub, GitLab, a self-hosted Gitea, or a university server. Browsers cannot reach Git servers directly, so the workspace relays through a proxy you can point at your own host. You can also just export the folder.'
		},
		{
			q: 'Does SyncTeX work?',
			a: 'Yes. Click anywhere in the rendered PDF and GlyphTeX jumps back to the line that produced it. The reverse works too: jump from a source line to the matching point in the preview.'
		},
		{
			q: 'Can I run it on a university-managed machine?',
			a: 'Yes. The workspace is a web page, so there is nothing to install and no admin rights to request. If a managed browser blocks site storage, use a normal window and export your project when you finish.'
		}
	];

	let openFaq = $state<number | null>(0);
</script>

<svelte:head>
	<title>GlyphTeX · A local-first LaTeX editor for academic writing</title>
	<meta
		name="description"
		content="GlyphTeX is a local-first LaTeX editor for academic writing. Plain .tex projects, compiled on your machine, versioned with Git. GPLv3, free for individuals and institutions."
	/>
</svelte:head>

{#snippet featureList(items: typeof openSources)}
	<ul class="mt-10 space-y-7">
		{#each items as item, i (item.title)}
			{@const Icon = item.icon}
			<Reveal as="li" variant="left" delay={i * 60} class="flex items-start gap-4">
				<span
					class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"
				>
					<Icon class="size-4.5" stroke-width={1.75} />
				</span>
				<span>
					<span class="block text-base font-semibold tracking-tight text-foreground"
						>{item.title}</span
					>
					<span class="mt-1.5 block text-base leading-relaxed text-muted-foreground"
						>{item.description}</span
					>
				</span>
			</Reveal>
		{/each}
	</ul>
{/snippet}

<div class="min-h-screen bg-background font-sans text-ink antialiased selection:bg-brand-subtle">
	<SiteHeader />

	<main id="main">
		<!-- Hero. White, one primary action, and the product immediately underneath. -->
		<section class="relative w-full overflow-hidden">
			<Container size="wide">
				<div class="flex flex-col items-center pt-36 pb-16 text-center md:pt-44">
					<a
						href={repo}
						target="_blank"
						rel="noopener noreferrer"
						class="mb-8 inline-flex items-center gap-1.5 rounded-full bg-surface-soft px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
						in:fly={{ y: 8, duration: 400, easing: cubicOut }}
					>
						<IconBrandGithub class="size-4" />
						Open source · GPLv3
					</a>

					<h1
						class="landing-display max-w-4xl"
						in:fly={{ y: 10, duration: 450, delay: 60, easing: cubicOut }}
					>
						LaTeX, on your machine.
					</h1>

					<!-- The rotator sits on its own centred line at lead size, not inside
					     the display type: an animated width inside a `text-wrap: balance`
					     H1 cannot be laid out predictably, and at 80px it clipped. Centred
					     and alone, it grows and shrinks symmetrically and moves nothing. -->
					<p
						class="mt-6 text-xl font-medium text-ink sm:text-2xl"
						in:fly={{ y: 10, duration: 450, delay: 100, easing: cubicOut }}
					>
						Write your
						<ContainerTextFlip words={rotatingWords} interval={2600} tone="brand" />
					</p>

					<p
						class="landing-lead mt-6 max-w-2xl"
						in:fly={{ y: 10, duration: 450, delay: 140, easing: cubicOut }}
					>
						Compile locally in milliseconds. Track every revision in Git. Nothing ever leaves your
						device.
					</p>

					<div
						class="mt-9 flex flex-col items-center gap-3 sm:flex-row"
						in:fly={{ y: 10, duration: 450, delay: 180, easing: cubicOut }}
					>
						<!-- Desktop download is hidden until the app is no longer a prototype.
						     Restore this button (and the /download nav entry) at release. -->
						<Button
							href={workspace}
							variant="brand"
							size="lg"
							onclick={() => track('cta_workspace_click', { location: 'hero' })}
						>
							{CTA_LABEL}
						</Button>
						<Button
							href={resolve('/engine')}
							variant="brand_soft"
							size="lg"
							onclick={() => track('cta_engine_click', { location: 'hero' })}
						>
							How the engine works
						</Button>
					</div>

					<ul
						class="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-sm font-medium text-muted-foreground"
						in:fly={{ y: 8, duration: 400, delay: 240, easing: cubicOut }}
					>
						{#each heroAssurances as item (item.label)}
							{@const Icon = item.icon}
							<li class="inline-flex items-center gap-1.5">
								<Icon class="text-brand size-4 shrink-0" stroke-width={2} />
								{item.label}
							</li>
						{/each}
					</ul>
				</div>

				<div class="pb-8" in:fly={{ y: 16, duration: 500, delay: 300, easing: cubicOut }}>
					<div class="landing-shot overflow-hidden">
						<EditorMock />
					</div>
				</div>
			</Container>
		</section>

		<!-- Trust strip. A static grid, not a marquee: nothing here needs to move. -->
		<Section spacing="tight">
			<Container size="wide">
				<p class="text-center text-base text-muted-foreground">
					Built on the tools your department already trusts
				</p>

				<ul class="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
					{#each techLogos as logo (logo.slug)}
						<li>
							<a
								href={logo.href}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center gap-2.5 text-foreground/70 transition-colors hover:text-foreground"
							>
								<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
									<path d={logo.path} />
								</svg>
								<span class="text-base font-semibold tracking-tight">{logo.name}</span>
							</a>
						</li>
					{/each}
				</ul>

				<Reveal variant="up">
					<ul
						class="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-hairline pt-10"
					>
						{#each openSourceClaims as claim (claim.label)}
							{@const Icon = claim.icon}
							<li class="inline-flex items-center gap-2 text-base text-muted-foreground">
								<Icon class="text-brand size-4.5 shrink-0" stroke-width={1.75} />
								{claim.label}
							</li>
						{/each}
					</ul>
				</Reveal>
			</Container>
		</Section>

		<!-- Why not cloud LaTeX. -->
		<Section id="why">
			<Container size="wide">
				<Reveal variant="up">
					<SectionHeader
						eyebrow="Why not cloud LaTeX"
						title="What you're up against."
						description="Writing a paper is not the same job as waiting on a compile queue, hunting for a licence seat, or trusting a server with your draft."
					/>
				</Reveal>

				<div class="mt-14 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
					<ul class="grid gap-3 sm:grid-cols-2">
						{#each painPoints as point, i (point.id)}
							{@const Icon = point.icon}
							<Reveal as="li" variant="up" delay={i * 60} class="h-full">
								<article class="landing-card flex h-full flex-col gap-3 p-6">
									<span
										class="grid size-9 place-items-center rounded-lg bg-background text-muted-foreground"
									>
										<Icon class="size-4.5" stroke-width={1.75} />
									</span>
									<p class="text-base leading-snug font-semibold text-foreground">{point.title}</p>
									<p class="text-base leading-relaxed text-muted-foreground">{point.description}</p>
								</article>
							</Reveal>
						{/each}
					</ul>

					<Reveal variant="up" delay={120} class="h-full">
						<article class="landing-card flex h-full flex-col gap-5 p-8">
							<span class="landing-eyebrow">What GlyphTeX does instead</span>
							<h3 class="landing-card-title">Every one of those, answered locally.</h3>

							<ul class="flex flex-col gap-3.5 pt-1">
								{#each solutions as solution (solution)}
									<li class="flex items-start gap-3 text-base leading-relaxed text-foreground">
										<span
											class="mt-1 grid size-4.5 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground"
										>
											<IconCheck class="size-3" stroke-width={3} />
										</span>
										<span>{solution}</span>
									</li>
								{/each}
							</ul>

							<p class="mt-auto pt-4 text-base text-muted-foreground">
								GPLv3 · No account · Runs offline
							</p>
						</article>
					</Reveal>
				</div>
			</Container>
		</Section>

		<!-- The workflow, in three beats: open, compile, track. -->
		<Section id="open" spacing="tight">
			<Container size="wide">
				<ShowcasePanel padding="none" class="p-6 sm:p-10 md:p-14">
					<div class="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
						<div>
							<Reveal variant="up">
								<SectionHeader
									eyebrow="Step 1 · Open"
									title="Open the project"
									emphasis="you already have."
									description="A folder of plain .tex files. Bring an Overleaf export, a thesis repo, or a blank document. No reshaping, no proprietary format."
								/>
							</Reveal>

							{@render featureList(openSources)}

							<div class="mt-10">
								<Button href={workspace} variant="brand">{CTA_LABEL}</Button>
							</div>
						</div>

						<Reveal variant="morph">
							<div class="landing-shot overflow-hidden">
								<EditorMock />
							</div>
						</Reveal>
					</div>
				</ShowcasePanel>
			</Container>
		</Section>

		<Section id="compile" spacing="tight">
			<Container size="wide">
				<ShowcasePanel padding="none" class="p-6 sm:p-10 md:p-14">
					<Reveal variant="up">
						<SectionHeader
							eyebrow="Step 2 · Compile"
							title="The engine runs"
							emphasis="while you write."
							description="Tectonic compiles on every save. The PDF stays live, the bibliography stays in sync, and no queue sits between you and the build."
							align="center"
						/>
					</Reveal>

					<PolishGrid features={polishFeatures} />
				</ShowcasePanel>
			</Container>
		</Section>

		<Section id="track" spacing="tight">
			<Container size="wide">
				<ShowcasePanel padding="none" class="p-6 sm:p-10 md:p-14">
					<div class="grid items-start gap-14 lg:grid-cols-2 lg:gap-20">
						<div>
							<Reveal variant="up">
								<SectionHeader
									eyebrow="Step 3 · Track"
									title="History stays"
									emphasis="in your repo."
									description="Diffs, commits, branches, and remotes live in your own repository. GlyphTeX handles the workflow; the archive stays yours."
								/>
							</Reveal>

							{@render featureList(trackFeatures)}
						</div>

						<Reveal variant="morph">
							<div class="landing-shot p-7 sm:p-8">
								<span
									class="inline-flex items-center gap-2 rounded-md bg-surface-soft px-2.5 py-1 font-mono text-sm text-muted-foreground"
								>
									<IconGitBranch class="size-3.5" />
									thesis · history
								</span>

								<h3 class="landing-card-title mt-6">
									Every commit is a sentence you can roll back to.
								</h3>
								<p class="mt-2 text-base leading-relaxed text-muted-foreground">
									The same Git you would use from the command line. The editor just makes the common
									cases a click away.
								</p>

								<ul class="mt-7 flex flex-col gap-2.5">
									{#each commits as commit (commit.hash)}
										<li class="flex items-center gap-3 rounded-lg bg-surface-soft px-3.5 py-3">
											<span class="size-2 shrink-0 rounded-full bg-success"></span>
											<div class="min-w-0 flex-1">
												<div class="truncate text-base font-medium text-foreground">
													{commit.msg}
												</div>
												<div class="mt-0.5 font-mono text-sm text-muted-foreground">
													{commit.hash} · {commit.when}
												</div>
											</div>
											<span
												class="rounded-md bg-background px-2 py-0.5 font-mono text-sm text-muted-foreground"
											>
												main
											</span>
										</li>
									{/each}
								</ul>
							</div>
						</Reveal>
					</div>
				</ShowcasePanel>
			</Container>
		</Section>

		<!-- Built for academics. -->
		<Section id="audience">
			<Container size="wide">
				<Reveal variant="up">
					<SectionHeader
						eyebrow="Built for academics"
						title="For the people who write papers."
						description="The workflow GlyphTeX is opinionated about is the one researchers already live in: a folder of .tex files, a bibliography, and a long revision history."
					/>
				</Reveal>

				<ul class="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
					{#each audienceCards as card, i (card.title)}
						{@const Icon = card.icon}
						<Reveal as="li" variant="up" delay={i * 70} class="h-full">
							<article class="landing-card landing-card-hover flex h-full flex-col p-8">
								<span class="grid size-10 place-items-center rounded-xl bg-background text-brand">
									<Icon class="size-5" stroke-width={1.75} />
								</span>
								<h3 class="landing-card-title mt-6">{card.title}</h3>
								<p class="mt-3 text-base leading-relaxed text-muted-foreground">{card.body}</p>
							</article>
						</Reveal>
					{/each}
				</ul>
			</Container>
		</Section>

		<!-- Institutions. Absorbs what used to be a separate pricing band. -->
		<Section id="institutions" spacing="tight">
			<Container size="wide">
				<ShowcasePanel padding="none" class="p-6 sm:p-10 md:p-14">
					<div class="grid gap-14 lg:grid-cols-[5fr_7fr] lg:gap-16">
						<div>
							<Reveal variant="up">
								<SectionHeader
									eyebrow="For universities and institutes"
									title="Free for the whole department."
									description="One department or every lab machine on campus. No seat count, no licence server, no contract to renew. Students keep the editor after they graduate."
								/>
							</Reveal>

							<Reveal variant="up" delay={80}>
								<dl class="mt-10 grid grid-cols-3 gap-6">
									{#each institutionStats as stat (stat.label)}
										<div>
											<dt class="text-3xl font-semibold tracking-tight text-foreground">
												{stat.value}
											</dt>
											<dd class="mt-1.5 text-sm leading-snug text-muted-foreground">
												{stat.label}
											</dd>
										</div>
									{/each}
								</dl>
							</Reveal>

							<Reveal variant="up" delay={140} class="mt-10 flex flex-wrap items-center gap-3">
								<Button
									href={institutionMailto}
									variant="brand"
									onclick={() => track('cta_institution_click', { location: 'institutions' })}
								>
									<IconMail class="size-4" />
									Talk to us about your campus
								</Button>
								<Button
									href="{repo}/blob/main/LICENSE"
									target="_blank"
									rel="noopener noreferrer"
									variant="brand_soft"
								>
									Read the licence
								</Button>
							</Reveal>

							<Reveal variant="up" delay={200}>
								<p class="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
									Tell us the department, the rough number of writers, and what your IT team needs
									to sign off on. Pilots usually start with one lab.
								</p>
							</Reveal>
						</div>

						<ul class="grid gap-3 sm:grid-cols-2">
							{#each institutionCards as card, i (card.title)}
								{@const Icon = card.icon}
								<Reveal as="li" variant="up" delay={i * 50} class="h-full">
									<article class="landing-card-outline landing-card-hover h-full p-6">
										<span class="bg-brand/10 text-brand grid size-9 place-items-center rounded-lg">
											<Icon class="size-4.5" stroke-width={1.75} />
										</span>
										<h3 class="mt-4 text-base font-semibold tracking-tight text-foreground">
											{card.title}
										</h3>
										<p class="mt-2 text-base leading-relaxed text-muted-foreground">
											{card.body}
										</p>
									</article>
								</Reveal>
							{/each}
						</ul>
					</div>
				</ShowcasePanel>
			</Container>
		</Section>

		<Section id="faq">
			<Container>
				<div class="grid gap-12 lg:grid-cols-12 lg:gap-14">
					<div class="lg:col-span-5">
						<div class="lg:sticky lg:top-28">
							<Reveal variant="up">
								<SectionHeader
									eyebrow="FAQ"
									title="Questions worth asking first."
									description="The things people check before moving a thesis to a new editor."
								/>
							</Reveal>
							<a
								href="{repo}/issues"
								target="_blank"
								rel="noopener noreferrer"
								class="group/tile mt-8 inline-flex items-center gap-2.5 text-base font-medium text-foreground"
							>
								<span class="landing-arrow">
									<IconArrowRight class="size-4" />
								</span>
								Ask something else
							</a>
						</div>
					</div>

					<div class="lg:col-span-7">
						<ul class="space-y-2">
							{#each faqs as faq, i (faq.q)}
								{@const open = openFaq === i}
								<li>
									<div
										class="overflow-hidden rounded-xl transition-colors duration-200 {open
											? 'bg-surface-soft'
											: 'hover:bg-surface-soft'}"
									>
										<button
											type="button"
											id={`faq-trigger-${i}`}
											onclick={() => (openFaq = open ? null : i)}
											aria-expanded={open}
											aria-controls={`faq-panel-${i}`}
											class="flex w-full items-start gap-3.5 px-5 py-4 text-left"
										>
											<span aria-hidden="true" class="mt-0.5 shrink-0 text-muted-foreground">
												{#if open}
													<IconMinus class="size-4.5" />
												{:else}
													<IconPlus class="size-4.5" />
												{/if}
											</span>
											<span class="flex-1 text-base font-semibold tracking-tight text-foreground">
												{faq.q}
											</span>
										</button>
										<!-- The panel always exists: `aria-controls` must resolve to a real
										     node even while the answer is collapsed. -->
										<div
											id={`faq-panel-${i}`}
											role="region"
											aria-labelledby={`faq-trigger-${i}`}
											class="overflow-hidden"
										>
											{#if open}
												<p
													transition:slide={{ duration: reducedMotion ? 0 : 200, easing: cubicOut }}
													class="pb-5 pl-[3.35rem] pr-5 text-base leading-relaxed text-muted-foreground"
												>
													{faq.a}
												</p>
											{/if}
										</div>
									</div>
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</Container>
		</Section>

		<!-- Closing CTA: a full-bleed tinted band, matching the section rhythm. -->
		<section id="cta" class="bg-surface-soft">
			<Container size="wide">
				<div class="flex flex-col items-center py-28 text-center md:py-36">
					<Reveal variant="up">
						<h2 class="landing-section-title">Your next paper, written locally.</h2>
					</Reveal>

					<Reveal variant="up" delay={70}>
						<p class="landing-lead mt-6 max-w-xl">
							Open a thesis in 30 seconds. Compile on your machine. Version it in Git. Free for
							individuals, free for the lab.
						</p>
					</Reveal>

					<Reveal variant="up" delay={140} class="mt-9 flex flex-wrap justify-center gap-3">
						<Button
							href={workspace}
							variant="brand"
							size="lg"
							onclick={() => track('cta_workspace_click', { location: 'final_cta' })}
						>
							{CTA_LABEL}
						</Button>
						<Button
							href={repo}
							target="_blank"
							rel="noopener noreferrer"
							variant="brand_soft"
							size="lg"
						>
							Read the source
						</Button>
					</Reveal>
				</div>
			</Container>
		</section>
	</main>

	<SiteFooter />
</div>
