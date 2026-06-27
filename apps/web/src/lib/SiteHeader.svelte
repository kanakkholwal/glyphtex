<script lang="ts">
    import { resolve } from '$app/paths';
    import { Logo } from '@glyphx/ui/logo';
    import { ThemeToggle } from '@glyphx/ui/theme-toggle';
    import { IconArrowUpRight, IconDownload, IconMenu2, IconX } from '@tabler/icons-svelte';

    const home = resolve('/');
    const repo = 'https://github.com/kanakkholwal/glyphx';

    const links = [
        { label: 'Features', href: `${home}#features` },
        { label: 'Compare', href: `${home}#compare` },
        { label: 'FAQ', href: `${home}#faq` }
    ];

    let open = $state(false);

    const navLink = 'text-sm font-medium text-muted-foreground transition-colors hover:text-foreground';
</script>

<header class="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div class="flex items-center gap-8">
            <Logo href={home} size={24} class="text-base tracking-tight" />

            <nav class="hidden items-center gap-6 md:flex">
                {#each links as l (l.href)}
                    <a href={l.href} class={navLink}>{l.label}</a>
                {/each}
                <a href={repo} target="_blank" rel="noopener noreferrer" class="group flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                    GitHub <IconArrowUpRight class="size-3.5 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
                </a>
            </nav>
        </div>

        <div class="flex items-center gap-3">
            <ThemeToggle />
            
            <a
                href={resolve('/editor')}
                class="hidden h-9 items-center justify-center rounded-md border border-border/40 bg-background px-4 text-sm font-medium transition-colors hover:bg-muted/50 sm:inline-flex"
            >
                Open Editor
            </a>
            <a
                href={resolve('/download')}
                class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground transition-transform hover:opacity-90 active:scale-[0.98]"
            >
                <IconDownload class="size-4" /> Download
            </a>
            
            <button
                type="button"
                class="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
                onclick={() => (open = !open)}
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
            >
                {#if open}<IconX class="size-5" />{:else}<IconMenu2 class="size-5" />{/if}
            </button>
        </div>
    </div>

    {#if open}
        <div class="border-t border-border/40 bg-background/95 p-4 backdrop-blur-xl md:hidden">
            <nav class="flex flex-col gap-2">
                {#each links as l (l.href)}
                    <a href={l.href} class="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onclick={() => (open = false)}>
                        {l.label}
                    </a>
                {/each}
                <a
                    href={repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onclick={() => (open = false)}
                >
                    GitHub <IconArrowUpRight class="size-4" />
                </a>
            </nav>
        </div>
    {/if}
</header>