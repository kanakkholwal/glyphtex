<script lang="ts" module>
	/** A prerendered first-page image; apps without one pass null and get a placeholder. */
	export type TemplateCardPreview = { src: string; width: number; height: number };
</script>

<script lang="ts">
	import { Image } from "@unpic/svelte";
	import { IconFileText } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";
	import { TEMPLATE_CATEGORIES, type ProjectTemplate } from "../../lib/project-templates";

	let {
		template: t,
		preview = null,
		href,
		priority = false,
		action
	}: {
		template: ProjectTemplate;
		preview?: TemplateCardPreview | null;
		/** Makes the whole card a link, e.g. to the template's page. */
		href?: string;
		/** Eager-load the image: only for cards in the first viewport. */
		priority?: boolean;
		/** The trailing control, usually "Use"; it sits above the card link. */
		action?: Snippet;
	} = $props();

	const label = $derived(TEMPLATE_CATEGORIES.find((c) => c.id === t.category)?.label ?? t.category);
	const landscape = $derived(preview ? preview.width > preview.height : false);
	const licence = $derived(t.license.replace("Creative Commons ", ""));
	const meta = $derived(
		[label, t.origin === "overleaf" ? t.author : t.documentClass, licence].filter(Boolean).join(" · ")
	);
</script>

<li class="group relative flex min-w-0 flex-col gap-2.5">
	<div class="bg-muted aspect-[4/3] rounded-xl p-1">
		<div
			class="border-border bg-background group-hover:border-border-strong relative h-full overflow-hidden rounded-lg border transition-[border-color] duration-(--duration-fast) ease-(--ease-out)"
		>
			{#if preview}
				<!-- A sheet resting in the frame: portrait pages crop at the bottom, slides sit centred. -->
				<div
					class={[
						"absolute inset-x-0 bottom-0 flex justify-center",
						landscape ? "top-0 items-center" : "top-5 items-start"
					]}
				>
					<div
						class={[
							"overflow-hidden rounded-sm shadow-(--surface-shadow) ring-1 ring-border transition-transform duration-(--duration-base) ease-(--ease-out) group-hover:-translate-y-0.5 motion-reduce:transition-none",
							landscape ? "w-[84%]" : "w-[62%]"
						]}
					>
						<Image
							src={preview.src}
							width={preview.width}
							height={preview.height}
							layout="fullWidth"
							alt="First page of the {t.title} template"
							loading={priority ? "eager" : "lazy"}
							class="block h-auto w-full"
						/>
					</div>
				</div>
			{:else}
				<div class="text-muted-foreground absolute inset-0 grid place-items-center">
					<IconFileText class="size-8" aria-hidden="true" />
				</div>
			{/if}
		</div>
	</div>
	<div class="flex items-start gap-2 px-0.5">
		<div class="min-w-0 flex-1">
			<h3 class="text-foreground truncate text-sm font-medium">
				{#if href}
					<a
						{href}
						class="focus-visible:ring-ring rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-2"
						aria-label="{t.title}: template details">{t.title}</a
					>
				{:else}
					{t.title}
				{/if}
			</h3>
			<p class="text-muted-foreground mt-0.5 truncate text-xs">{meta}</p>
		</div>
		{#if action}
			<div class="relative z-10 shrink-0">{@render action()}</div>
		{/if}
	</div>
</li>
