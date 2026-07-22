<script lang="ts" module>
	/** Where GlyphTeX lives — kept here so the About box and any future "Help"
	 * surface read the same canonical links. */
	export const GLYPHTEX_REPO = "https://github.com/kanakkholwal/glyphtex";
	export const GLYPHTEX_SITE = "https://glyphtex.nexonauts.com";
</script>

<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { Dialog, DialogContent } from "@glyphtex/ui/dialog";
	import { Logo } from "@glyphtex/ui/logo";
	import { IconBrandGithub, IconWorld } from '@tabler/icons-svelte';

	/**
	 * AboutDialog — a compact "About GlyphTeX" card: the brand lockup, a one-line
	 * description of what the app is, the build version, and links out to the
	 * source and the website. Purely informational; no actions beyond the links.
	 */
	let {
		open = $bindable(false),
		platform = "desktop",
		version = "0.1.0",
	}: {
		open?: boolean;
		platform?: "web" | "desktop";
		version?: string;
	} = $props();
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-md">
		<div class="flex flex-col items-center gap-4 pt-2 text-center">
			<Logo text={false} badge size={56} />

			<div class="flex flex-col items-center gap-1.5">
				<h2 class="font-display text-foreground text-xl font-semibold tracking-tight">
					GlyphTeX
				</h2>
				<p class="text-muted-foreground text-sm leading-relaxed text-balance">
					A local-first LaTeX editor
				</p>
			</div>

			<div class="text-muted-foreground/80 flex items-center gap-2 text-xs">
				<span class="tabular-nums">Version {version}</span>
				<span class="bg-border h-3 w-px"></span>
				<span class="capitalize">{platform}</span>
			</div>

			<div class="mt-1 flex w-full items-center justify-center gap-2">
				<Button
					href={GLYPHTEX_REPO}
					target="_blank"
					rel="noreferrer noopener"
					variant="outline"
					size="sm"
				>
					<IconBrandGithub />
					GitHub
				</Button>
				<Button
					href={GLYPHTEX_SITE}
					target="_blank"
					rel="noreferrer noopener"
					variant="outline"
					size="sm"
				>
					<IconWorld />
					Website
				</Button>
			</div>

			<p class="text-muted-foreground/60 text-xs">
				Built by <a href="https://x.com/kanakkholwal" target="_blank" rel="noreferrer noopener" class="underline hover:no-underline">@kanakkholwal</a>. Open source under the project license.
			</p>
		</div>
	</DialogContent>
</Dialog>
