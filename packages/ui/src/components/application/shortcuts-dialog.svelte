<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from "@glyphtex/ui/dialog";
	import { Kbd } from "@glyphtex/ui/kbd";
	import { IconKeyboard } from "@tabler/icons-svelte";

	import { isMacPlatform, shortcutCategories, shortcutsByCategory, formatCombo } from "./shortcuts";

	// Read-only shortcut reference, grouped by category, read entirely from the shortcuts registry.
	let { open = $bindable(false) }: { open?: boolean } = $props();

	const mac = isMacPlatform();
	const categories = shortcutCategories();

	/** Split a formatted combo into keycaps: macOS packs it (⌘⇧Z) into one cap,
	 *  elsewhere "Ctrl+Shift+Z" splits on "+". */
	function caps(combo: string): string[] {
		const formatted = formatCombo(combo, mac);
		return mac ? [formatted] : formatted.split("+");
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-3xl">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<IconKeyboard size={18} class="text-muted-foreground" />
				Keyboard shortcuts
			</DialogTitle>
			<DialogDescription>
				Everything you can drive from the keyboard. {mac ? '⌘ is Command.' : 'Mod is the Ctrl key.'}
			</DialogDescription>
		</DialogHeader>

		<div class="-mx-1 max-h-[60vh] overflow-y-auto px-1">
			<!-- Masonry-style flow: each category box stays intact while the set fills
			     two columns (three on wide screens). -->
			<div class="gap-4 sm:columns-2 lg:columns-3 [&>section]:mb-4 [&>section]:break-inside-avoid">
				{#each categories as category (category)}
					<section class="border-border bg-card/40 rounded-lg border p-3">
						<h3 class="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
							{category}
						</h3>
						<ul class="flex flex-col gap-1.5">
							{#each shortcutsByCategory(category) as s (s.id)}
								<li class="flex items-center justify-between gap-3">
									<span class="text-foreground text-xs">{s.label}</span>
									<span class="flex shrink-0 items-center gap-1">
										{#each s.combos as combo, i (combo)}
											{#if i > 0}
												<span class="text-muted-foreground text-xs">or</span>
											{/if}
											{#each caps(combo) as cap (cap)}
												<Kbd>{cap}</Kbd>
											{/each}
										{/each}
									</span>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		</div>
	</DialogContent>
</Dialog>
