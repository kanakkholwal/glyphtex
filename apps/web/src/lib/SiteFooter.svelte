<script lang="ts">
    import { resolve } from '$app/paths';
    import { Logo } from '@glyphx/ui/logo';
    import { IconBrandGithub } from '@tabler/icons-svelte';

    const home = resolve('/');
    const repo = 'https://github.com/kanakkholwal/glyphx';
    const year = 2026;

    const groups = [
        {
            title: 'Product',
            links: [
                { label: 'Features', href: `${home}#features` },
                { label: 'Compare', href: `${home}#compare` },
                { label: 'Download', href: resolve('/download') },
                { label: 'Open the editor', href: resolve('/editor') }
            ]
        },
        {
            title: 'Project',
            links: [
                { label: 'Why we built it', href: `${home}#why` },
                { label: 'FAQ', href: `${home}#faq` },
                { label: 'Source code', href: repo, external: true },
                { label: 'Releases', href: `${repo}/releases`, external: true }
            ]
        }
    ];
</script>

<footer class="border-t border-border/40 bg-background">
    <div class="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div class="grid gap-12 sm:grid-cols-[2fr_1fr_1fr]">
            
            <div class="max-w-sm">
                <Logo href={home} size="md" class="text-foreground" />
                <p class="mt-5 text-sm leading-relaxed text-muted-foreground">
                    A LaTeX editor that runs on your machine. Your drafts stay on your disk, your work
                    compiles offline, and there is no account to sign up for.
                </p>
                <a
                    href={repo}
                    target="_blank"
                    rel="noreferrer"
                    class="group mt-6 inline-flex items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                    <IconBrandGithub class="size-4 opacity-70 transition-opacity group-hover:opacity-100" /> Star it on GitHub
                </a>
            </div>

            {#each groups as g (g.title)}
                <div>
                    <h3 class="text-sm font-semibold text-foreground">{g.title}</h3>
                    <ul class="mt-6 flex flex-col gap-3">
                        {#each g.links as l (l.label)}
                            <li>
                                <a
                                    class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                                    href={l.href}
                                    target={l.external ? '_blank' : undefined}
                                    rel={l.external ? 'noreferrer' : undefined}
                                >
                                    {l.label}
                                </a>
                                </li>
                        {/each}
                    </ul>
                </div>
            {/each}
        </div>

        <div class="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border/40 pt-8 sm:flex-row sm:items-center">
            <span class="text-sm text-muted-foreground">© {year} GlyphX. Local-first typesetting.</span>
            <span class="text-sm text-muted-foreground">Built for people who write LaTeX, not for a server farm.</span>
        </div>
    </div>
</footer>