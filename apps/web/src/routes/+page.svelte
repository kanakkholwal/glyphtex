<script lang="ts">
    import { resolve } from '$app/paths';
    import FloatingGlyphs from '$lib/FloatingGlyphs.svelte';
    import SiteFooter from '$lib/SiteFooter.svelte';
    import SiteHeader from '$lib/SiteHeader.svelte';
    import { trackEvent } from '$lib/analytics';
    import { Reveal } from '@glyphx/ui/reveal';
    import {
    	IconAlertTriangle,
    	IconArrowRight,
    	IconBolt,
    	IconCheck,
    	IconChevronDown,
    	IconCloud,
    	IconCpu,
    	IconDownload,
    	IconFileText,
    	IconFolder,
    	IconGitBranch,
    	IconKey,
    	IconLayoutColumns,
    	IconLock,
    	IconMinus,
    	IconPlayerPlay,
    	IconShare,
    	IconStar,
    	IconWifiOff
    } from '@tabler/icons-svelte';
    import { onMount } from 'svelte';

    let heroImgOk = $state(true);
    const repo = 'https://github.com/kanakkholwal/glyphx';
    let stars = $state<number | null>(null);

    function formatStars(n: number): string {
        return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
    }

    onMount(async () => {
        try {
            const r = await fetch('https://api.github.com/repos/kanakkholwal/glyphx');
            if (r.ok) {
                const d = (await r.json()) as { stargazers_count?: unknown };
                if (typeof d.stargazers_count === 'number') stars = d.stargazers_count;
            }
        } catch {}
    });

    type FeatureItem = { icon: typeof IconFileText; title: string; body: string };
    type FeatureSection = {
        eyebrow: string;
        headline: string;
        items: FeatureItem[];
        mount: 'editor' | 'git';
        cta: string;
        href: string;
    };

    const featureSections: FeatureSection[] = [
        {
            eyebrow: 'Write & Compile',
            headline: 'Real LaTeX, compiled on <span class="text-foreground">your own machine</span>.',
            items: [
                {
                    icon: IconFileText,
                    title: 'Real LaTeX',
                    body: 'Full math, figures, BibTeX, and the packages a journal template or thesis class needs. What you write is standard .tex.'
                },
                {
                    icon: IconBolt,
                    title: 'Local engine',
                    body: 'The compiler runs on your computer. No shared queue, no server, and no timeout the night before a deadline.'
                },
                {
                    icon: IconLayoutColumns,
                    title: 'Source & page',
                    body: 'Write on the left, watch it render on the right. Double-click the PDF to jump to the line that made it.'
                }
            ],
            mount: 'editor',
            cta: 'Try it in the browser',
            href: resolve('/editor')
        },
        {
            eyebrow: 'Version & Privacy',
            headline: 'Your history and your drafts, <span class="text-foreground">yours alone</span>.',
            items: [
                {
                    icon: IconGitBranch,
                    title: 'Git built in',
                    body: 'Stage and commit, read a side-by-side diff, browse history, clone, and push or pull with your own remote.'
                },
                {
                    icon: IconLock,
                    title: 'Private by default',
                    body: 'Unpublished results, grant drafts, a thesis under embargo — none of it is uploaded, indexed, or fed to a model.'
                },
                {
                    icon: IconWifiOff,
                    title: 'Offline always',
                    body: 'The editor and the engine both run on your machine, so a flaky connection never stops you mid-sentence.'
                }
            ],
            mount: 'git',
            cta: 'See the full comparison',
            href: '#compare'
        }
    ];

    const integrations = [
        { icon: IconBolt, label: 'Tectonic', note: 'Bundled engine' },
        { icon: IconCpu, label: 'TeX Live', note: 'System engine' },
        { icon: IconCpu, label: 'MiKTeX', note: 'System engine' },
        { icon: IconFileText, label: 'BibTeX & Biber', note: 'Bibliographies' },
        { icon: IconGitBranch, label: 'Git', note: 'Your remote' },
        { icon: IconFolder, label: 'Overleaf projects', note: 'Drop the folder' }
    ];

    type LogLevel = 'ERROR' | 'WARN';
    type LogLine = { time: string; level: LogLevel; msg: string };
    const cloudLog: LogLine[] = [
        { time: '14:02', level: 'ERROR', msg: 'compile timed out — free-tier limit reached' },
        { time: '14:03', level: 'WARN', msg: 'upgrade required to keep working' },
        { time: '14:04', level: 'WARN', msg: 'version history locked behind a paid plan' },
        { time: '14:06', level: 'ERROR', msg: 'editor lagging — keystroke round-trips a server' },
        { time: '14:07', level: 'WARN', msg: 'draft stored on infrastructure you do not control' },
        { time: '14:09', level: 'ERROR', msg: 'no connection — the cloud editor is unavailable' }
    ];

    const logLevelClass: Record<LogLevel, string> = {
        ERROR: 'text-destructive font-medium',
        WARN: 'text-warning font-medium'
    };

    const local = [
        { icon: IconCpu, title: 'The compiler', body: 'The LaTeX engine runs on your computer. Nothing is queued on our servers.' },
        { icon: IconFolder, title: 'Your files', body: 'Projects are folders on your disk. Opening one reads a directory, saving writes a file.' },
        { icon: IconGitBranch, title: 'Your history', body: 'Commits live in your own Git repository, on your machine and on the remote you pick.' }
    ];

    const connected = [
        { icon: IconKey, title: 'Your AI key', body: 'Connect a key from a provider you trust. Requests go straight to them.', tag: 'Planned' },
        { icon: IconCloud, title: 'Your cloud storage', body: 'Sync through Dropbox or Google Drive, on the account you already pay for.', tag: 'Planned' },
        { icon: IconShare, title: 'Sharing', body: 'Hand a project to a collaborator, stored only while shared and only under your name.', tag: 'Planned' }
    ];

    type Cell = boolean | string;
    type Row = { label: string; glyph: Cell; overleaf: Cell; desktop: Cell };
    const comparison: Row[] = [
        { label: 'Real LaTeX, journal-ready output', glyph: true, overleaf: true, desktop: true },
        { label: 'Runs fully offline', glyph: true, overleaf: false, desktop: true },
        { label: 'Nothing uploaded to a server', glyph: true, overleaf: false, desktop: true },
        { label: 'No compile timeout', glyph: true, overleaf: 'Free limit', desktop: true },
        { label: 'Git built in', glyph: true, overleaf: 'Paid', desktop: 'BYO' },
        { label: 'Version history without paying', glyph: 'Built in', overleaf: 'Paid', desktop: 'Your VCS' },
        { label: 'AI help with your own key', glyph: 'Planned', overleaf: 'Paid', desktop: false },
        { label: 'Free, no account required', glyph: true, overleaf: 'Limited', desktop: true }
    ];

    const faqs = [
        { q: 'Is this real LaTeX or a watered-down version?', a: 'Real LaTeX. Full math, environments, figures, and BibTeX, with the packages a journal template or thesis class needs. What you write is standard .tex that any LaTeX setup can read.' },
        { q: 'Do I have to install a TeX distribution?', a: 'No. The desktop app ships with the engine built in, and the browser editor compiles in the page. There is no multi-gigabyte download and no package manager to fight.' },
        { q: 'Where do my files live?', a: 'On your disk. A project is a normal folder of .tex and .bib files. Nothing is copied to a server, so backups, syncing, and Git are entirely your call.' },
        { q: 'Can I bring my Overleaf projects over?', a: 'Yes. Overleaf projects are plain LaTeX underneath. Download the project folder, drop it into GlyphX, and keep writing.' },
        { q: 'Does it use AI, and where would my data go?', a: 'AI help is on the roadmap and will be opt in with your own key. We are not in the path, and there is no shared model trained on your writing.' }
    ];
</script>

<svelte:head>
    <title>GlyphX: The modern local-first LaTeX editor</title>
    <meta name="description" content="GlyphX is a local-first LaTeX editor for researchers. Write in real LaTeX, compile locally, and keep drafts private." />
</svelte:head>

<div class="bg-background text-foreground min-h-screen selection:bg-brand/20 font-sans antialiased">
    <SiteHeader />

    <section class="relative overflow-hidden pb-20 pt-32 sm:pt-40">
        <FloatingGlyphs />
        
        <div class="pointer-events-none absolute left-1/2 top-0 -z-10 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/4 opacity-30 blur-[120px]" style="background: radial-gradient(circle, var(--brand) 0%, transparent 70%);" aria-hidden="true"></div>

        <div class="relative mx-auto max-w-6xl px-6">
            <div class="flex flex-col items-center text-center">
                
                <a href={repo} target="_blank" rel="noopener noreferrer" class="group mb-8 inline-flex items-center gap-2 rounded-full border border-border/40 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-md transition-colors hover:bg-muted/50 hover:text-foreground">
                    <IconStar class="size-3.5 text-brand" />
                    Star on GitHub
                    {#if stars !== null}
                        <span class="ml-1 flex items-center gap-1 border-l border-border/40 pl-2 text-foreground">
                            {formatStars(stars)}
                        </span>
                    {/if}
                    <IconArrowRight class="size-3 transition-transform group-hover:translate-x-0.5" />
                </a>

                <h1 class="mx-auto max-w-4xl text-balance text-4xl font-semibold tracking-tighter sm:text-6xl md:text-7xl">
                    The LaTeX editor Overleaf <br class="hidden sm:block" />
                    <span class="text-muted-foreground">should have been.</span>
                </h1>
                
                <p class="mx-auto mt-6 max-w-2xl text-balance text-lg tracking-tight text-muted-foreground sm:text-xl">
                    Write papers, proofs, and theses in real LaTeX. The editor, compiler, and Git run blazingly fast on your own machine.
                </p>
                
                <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <a href={resolve('/download')} onclick={() => trackEvent('cta_download_click', { location: 'hero' })} class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground px-8 text-sm font-medium text-background transition-transform hover:scale-[0.98] sm:w-auto">
                        <IconDownload class="size-4" /> Download App
                    </a>
                    <a href={resolve('/editor')} class="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border/50 bg-background px-8 text-sm font-medium transition-colors hover:bg-muted/50 sm:w-auto">
                        <IconPlayerPlay class="size-4 text-brand" /> Open Browser Editor
                    </a>
                </div>
            </div>

            <div class="relative mx-auto mt-20 max-w-5xl">
                <div class="rounded-xl border border-border/40 bg-card/50 p-2 shadow-2xl backdrop-blur-xl">
                    <div class="overflow-hidden rounded-lg border border-border/20 bg-background">
                        <div class="flex h-10 items-center gap-2 border-b border-border/40 bg-muted/20 px-4">
                            <div class="flex gap-1.5">
                                <div class="size-2.5 rounded-full bg-muted-foreground/30"></div>
                                <div class="size-2.5 rounded-full bg-muted-foreground/30"></div>
                                <div class="size-2.5 rounded-full bg-muted-foreground/30"></div>
                            </div>
                            <span class="ml-4 font-mono text-xs text-muted-foreground">thesis.tex</span>
                        </div>
                        {#if heroImgOk}
                            <img src="/hero-editor.png" alt="GlyphX Live Preview" class="block w-full" onerror={() => (heroImgOk = false)} />
                        {:else}
                            <div class="grid grid-cols-1 md:grid-cols-2">
                                <div class="border-b border-border/40 p-6 md:border-b-0 md:border-r">
                                    <pre class="font-mono text-[13px] leading-relaxed text-muted-foreground">
<span class="text-brand">\documentclass</span>&#123;article&#125;
<span class="text-brand">\usepackage</span>&#123;amsmath&#125;

<span class="text-brand">\title</span>&#123;On Local-First Typesetting&#125;
<span class="text-brand">\author</span>&#123;A. Researcher&#125;

<span class="text-brand">\begin</span>&#123;document&#125;
<span class="text-brand">\maketitle</span>

We observe that the estimator <span class="text-foreground">$\hat&#123;\theta&#125;$</span>
is consistent...
<span class="text-brand">\end</span>&#123;document&#125;</pre>
                                </div>
                                <div class="bg-muted/10 p-8">
                                    <h3 class="mb-2 text-2xl font-semibold tracking-tight">On Local-First Typesetting</h3>
                                    <p class="mb-6 text-sm text-muted-foreground">A. Researcher</p>
                                    <p class="leading-relaxed text-foreground/80">
                                        We observe that the estimator θ̂ is consistent...
                                    </p>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="border-y border-border/40 bg-muted/10 py-12">
        <div class="mx-auto max-w-5xl px-6">
            <p class="text-center font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Works with your existing workflow
            </p>
            <div class="mt-8 flex flex-wrap justify-center gap-x-12 gap-y-6">
                {#each integrations as it}
                    <div class="flex items-center gap-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        <it.icon class="size-4 text-brand" /> {it.label}
                    </div>
                {/each}
            </div>
        </div>
    </section>

    <section class="py-24 sm:py-32">
        <div class="mx-auto max-w-6xl px-6">
            <div class="grid items-center gap-16 lg:grid-cols-2">
                <Reveal variant="up">
                    <h2 class="text-3xl font-semibold tracking-tighter sm:text-4xl">
                        Escape the cloud errors.
                    </h2>
                    <p class="mt-4 text-lg tracking-tight text-muted-foreground">
                        Overleaf made LaTeX accessible, but cloud limits slow you down. Timeouts, sync lags, and locked histories aren't LaTeX problems—they are server problems. 
                    </p>
                </Reveal>

                <Reveal variant="up" delay={80}>
                    <div class="rounded-xl border border-border/40 bg-card shadow-sm">
                        <div class="flex items-center justify-between border-b border-border/40 px-4 py-3">
                            <span class="font-mono text-xs text-muted-foreground">cloud.log</span>
                            <span class="inline-flex items-center gap-1.5 rounded bg-destructive/10 px-2 py-0.5 font-mono text-[10px] font-medium text-destructive">
                                <IconAlertTriangle class="size-3" /> {cloudLog.length} Issues
                            </span>
                        </div>
                        <div class="p-4 font-mono text-[12px] leading-relaxed">
                            {#each cloudLog as line, i}
                                <Reveal as="div" variant="up" delay={i * 50} class="flex gap-3 py-1">
                                    <span class="text-muted-foreground/50">{line.time}</span>
                                    <span class="{logLevelClass[line.level]} w-10">{line.level}</span>
                                    <span class="text-foreground/80">{line.msg}</span>
                                </Reveal>
                            {/each}
                            <div class="mt-3 border-t border-border/40 pt-3">
                                <Reveal as="div" variant="up" delay={cloudLog.length * 50} class="flex gap-3">
                                    <span class="text-brand">glyphx ▸</span>
                                    <span class="text-foreground">0 problems · local compile active</span>
                                </Reveal>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </div>
        </div>
    </section>

    <section id="features" class="flex flex-col gap-24 py-24 sm:py-32">
        {#each featureSections as sec, si}
            {@const flip = si % 2 === 1}
            <div class="mx-auto max-w-6xl px-6">
                <Reveal variant="up" class="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
                    <div class={flip ? 'lg:order-last' : ''}>
                        <span class="font-mono text-[11px] font-medium uppercase tracking-widest text-brand">
                            {sec.eyebrow}
                        </span>
                        <h2 class="mt-3 text-3xl font-semibold tracking-tighter sm:text-4xl">
                            {@html sec.headline}
                        </h2>
                        
                        <div class="mt-8 flex flex-col gap-6">
                            {#each sec.items as it}
                                <div class="flex gap-4">
                                    <div class="mt-1 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50">
                                        <it.icon class="size-4 text-brand" />
                                    </div>
                                    <div>
                                        <h3 class="text-sm font-semibold">{it.title}</h3>
                                        <p class="mt-1 text-sm text-muted-foreground">{it.body}</p>
                                    </div>
                                </div>
                            {/each}
                        </div>
                        
                        <a href={sec.href} class="group mt-10 inline-flex items-center gap-2 text-sm font-medium text-brand">
                            {sec.cta} <IconArrowRight class="size-4 transition-transform group-hover:translate-x-1" />
                        </a>
                    </div>
                    
                    <div class="relative w-full rounded-xl border border-border/40 bg-muted/20 p-2 shadow-sm">
                        <div class="h-64 rounded-lg bg-card/80 p-4 font-mono text-sm text-muted-foreground ring-1 ring-border/20 backdrop-blur-sm sm:h-80">
                            {#if sec.mount === 'editor'}
                                <span class="text-brand">\documentclass</span>&#123;article&#125;<br/><br/>
                                <span class="text-brand">\begin</span>&#123;document&#125;<br/>
                                Local-first execution is superior.<br/>
                                <span class="text-brand">\end</span>&#123;document&#125;
                            {:else}
                                <div class="flex items-center gap-2"><IconGitBranch class="size-4 text-brand"/> main</div>
                                <div class="mt-4 flex flex-col gap-2">
                                    <div class="flex items-center gap-2"><span class="text-warning">M</span> thesis.tex</div>
                                    <div class="flex items-center gap-2"><span class="text-success">A</span> fig1.pdf</div>
                                </div>
                            {/if}
                        </div>
                    </div>
                </Reveal>
            </div>
        {/each}
    </section>

    <section id="compare" class="border-t border-border/40 bg-muted/5 py-24 sm:py-32">
        <div class="mx-auto max-w-5xl px-6">
            <Reveal variant="up" class="text-center">
                <h2 class="text-3xl font-semibold tracking-tighter sm:text-4xl">
                    Private like your laptop. Easy like the cloud.
                </h2>
            </Reveal>

            <Reveal variant="up" delay={80} class="mt-16 overflow-x-auto">
                <div class="min-w-[640px] rounded-xl border border-border/40 bg-background text-sm shadow-sm">
                    <div class="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-border/40 bg-muted/30 p-4 font-medium text-muted-foreground">
                        <div>Feature</div>
                        <div class="flex items-center gap-2 text-foreground"><IconStar class="size-4 text-brand"/> GlyphX</div>
                        <div>Overleaf Free</div>
                        <div>Desktop TeX</div>
                    </div>
                    {#each comparison as row}
                        <div class="grid grid-cols-[2fr_1fr_1fr_1fr] items-center border-b border-border/40 p-4 last:border-0">
                            <div class="font-medium text-foreground/90">{row.label}</div>
                            <div class="font-medium">
                                {#if row.glyph === true} <IconCheck class="size-4 text-brand" />
                                {:else} <span class="text-brand">{row.glyph}</span> {/if}
                            </div>
                            <div class="text-muted-foreground">
                                {#if row.overleaf === true} <IconCheck class="size-4" />
                                {:else if row.overleaf} {row.overleaf}
                                {:else} <IconMinus class="size-4 opacity-50" /> {/if}
                            </div>
                            <div class="text-muted-foreground">
                                {#if row.desktop === true} <IconCheck class="size-4" />
                                {:else if row.desktop} {row.desktop}
                                {:else} <IconMinus class="size-4 opacity-50" /> {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </Reveal>
        </div>
    </section>

    <section id="faq" class="py-24 sm:py-32">
        <div class="mx-auto max-w-3xl px-6">
            <Reveal variant="up" class="text-center">
                <h2 class="text-3xl font-semibold tracking-tighter">Frequently Asked Questions</h2>
            </Reveal>

            <div class="mt-12 flex flex-col gap-px bg-border/40">
                {#each faqs as f, i}
                    <Reveal variant="up" delay={i * 40} class="group bg-background p-6 open:bg-muted/10">
                        <summary class="flex cursor-pointer items-center justify-between font-medium [&::-webkit-details-marker]:hidden">
                            {f.q}
                            <IconChevronDown class="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <p class="mt-4 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                    </Reveal>
                {/each}
            </div>
        </div>
    </section>

    <section class="py-24 sm:py-32">
        <div class="mx-auto max-w-4xl px-6">
            <Reveal variant="scale">
                <div class="relative flex flex-col items-center overflow-hidden rounded-2xl bg-foreground px-6 py-20 text-center text-background">
                    <h2 class="text-3xl font-semibold tracking-tighter sm:text-5xl">
                        Keep your research on your machine.
                    </h2>
                    <p class="mt-4 text-lg text-background/70">
                        Start instantly in the browser or download the native app for fully offline execution.
                    </p>
                    <div class="mt-10 flex flex-col gap-4 sm:flex-row">
                        <a href={resolve('/download')} class="inline-flex h-11 items-center justify-center rounded-md bg-background px-8 text-sm font-medium text-foreground transition-transform hover:scale-[0.98]">
                            Download GlyphX
                        </a>
                        <a href={resolve('/editor')} class="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-background/20 px-8 text-sm font-medium text-background transition-colors hover:bg-background/10">
                            Open Editor <IconArrowRight class="size-4" />
                        </a>
                    </div>
                </div>
            </Reveal>
        </div>
    </section>

    <SiteFooter />
</div>