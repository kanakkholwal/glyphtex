<script lang="ts">
	import { settings, type Appearance } from "@glyphtex/ui/settings";
	import { IconCheck } from "@tabler/icons-svelte";

	import SettingsSection from "./SettingsSection.svelte";

	// Preview colours are fixed so each card shows its own theme whichever one is active. RadioGroup's
	// card variant has no media slot (see .local/baby-ui-gaps.md), so this is a custom radio card.
	const themes: { value: Appearance; label: string; hint: string; preview: string; ink: string }[] =
		[
			{
				value: "light",
				label: "Light",
				hint: "Paper white",
				preview: "bg-(--fixed-light)",
				ink: "bg-(--fixed-dark)/10"
			},
			{
				value: "dark",
				label: "Dark",
				hint: "Easy on the eyes",
				preview: "bg-(--fixed-dark)",
				ink: "bg-(--fixed-light)/15"
			},
			{
				value: "system",
				label: "System",
				hint: "Follows your device",
				preview: "bg-[linear-gradient(135deg,var(--fixed-light)_50%,var(--fixed-dark)_50%)]",
				ink: "bg-(--fixed-dark)/15"
			}
		];
</script>

<div class="flex flex-col gap-10">
	<SettingsSection title="Appearance" description="Applies to the workspace and the editor in this browser.">
		<div role="radiogroup" aria-label="Theme" class="grid grid-cols-3 gap-3">
			{#each themes as t (t.value)}
				{@const selected = settings.appearance === t.value}
				<button
					type="button"
					role="radio"
					aria-checked={selected}
					class="bg-tint hover:bg-tint-hover focus-visible:ring-ring aria-checked:ring-primary flex flex-col gap-3 rounded-xl p-2 text-left outline-none transition-[background-color,box-shadow] duration-(--duration-fast) ease-(--ease-out) focus-visible:ring-2 aria-checked:ring-2"
					onclick={() => (settings.appearance = t.value)}
				>
					<span class="{t.preview} flex aspect-[16/10] overflow-hidden rounded-lg shadow-(--surface-shadow)" aria-hidden="true">
						<span class="flex w-1/4 flex-col gap-1.5 p-2">
							<span class="{t.ink} h-1.5 w-full rounded-full"></span>
							<span class="{t.ink} h-1.5 w-2/3 rounded-full"></span>
							<span class="{t.ink} h-1.5 w-3/4 rounded-full"></span>
						</span>
						<span class="flex flex-1 flex-col gap-1.5 p-2 pt-3">
							<span class="{t.ink} h-2 w-1/2 rounded-full"></span>
							<span class="{t.ink} h-1.5 w-5/6 rounded-full"></span>
							<span class="{t.ink} h-1.5 w-2/3 rounded-full"></span>
						</span>
					</span>
					<span class="flex items-center justify-between gap-2 px-1 pb-0.5">
						<span class="flex flex-col">
							<span class="text-foreground text-sm font-medium">{t.label}</span>
							<span class="text-muted-foreground text-xs">{t.hint}</span>
						</span>
						<IconCheck
							class="text-primary size-4 shrink-0 transition-opacity duration-(--duration-fast) {selected ? 'opacity-100' : 'opacity-0'}"
							aria-hidden="true"
						/>
					</span>
				</button>
			{/each}
		</div>
	</SettingsSection>

	<SettingsSection
		title="Where your work lives"
		description="Nothing leaves this device unless you save a project to a GlyphTeX server."
	>
		<ul class="bg-tint divide-border flex flex-col divide-y rounded-xl">
			<li class="flex flex-col gap-0.5 p-4">
				<p class="text-foreground text-sm font-medium">Documents</p>
				<p class="text-muted-foreground text-sm">Stored in this browser's storage, per site.</p>
			</li>
			<li class="flex flex-col gap-0.5 p-4">
				<p class="text-foreground text-sm font-medium">Compiling</p>
				<p class="text-muted-foreground text-sm">Runs on this device with the in-browser TeX engine.</p>
			</li>
		</ul>
	</SettingsSection>
</div>
