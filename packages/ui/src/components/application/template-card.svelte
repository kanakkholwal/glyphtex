<script lang="ts" module>
	/** A prerendered first-page image; apps without one pass null and get a placeholder. */
	export type TemplateCardPreview = { src: string; width: number; height: number };
</script>

<script lang="ts">
	import { Image } from "@unpic/svelte";
	import { IconFileText } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";
	import { TEMPLATE_CATEGORIES, type ProjectTemplate } from "../../lib/project-templates";
	import {
		ShowcaseCard,
		ShowcaseCardAction,
		ShowcaseCardCopy,
		ShowcaseCardDescription,
		ShowcaseCardFooter,
		ShowcaseCardLink,
		ShowcaseCardPreview,
		ShowcaseCardTitle
	} from "../ui/showcase-card";

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
		/** The footer control, usually "Use"; it sits above the card link. */
		action?: Snippet;
	} = $props();

	const label = $derived(TEMPLATE_CATEGORIES.find((c) => c.id === t.category)?.label ?? t.category);
	const landscape = $derived(preview ? preview.width > preview.height : false);
	const licence = $derived(t.license.replace("Creative Commons ", ""));
</script>

<li class="min-w-0">
	<ShowcaseCard variant="solid" class="h-full">
		<ShowcaseCardPreview class="aspect-[4/3] bg-card">
			<span
				class="absolute top-3 left-3 z-10 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
			>
				{label}
			</span>
			{#if preview}
				<!-- A sheet resting in the frame: portrait pages crop at the bottom, slides sit centred. -->
				<div
					class={[
						"absolute inset-x-0 bottom-0 flex justify-center",
						landscape ? "top-0 items-center" : "top-10 items-start"
					]}
				>
					<div
						class={[
							"overflow-hidden rounded-sm shadow-(--surface-shadow) ring-1 ring-border transition-transform duration-(--duration-base) ease-(--ease-out) group-hover/showcase:-translate-y-1 motion-reduce:transition-none",
							landscape ? "w-[84%]" : "w-[64%]"
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
				<div class="absolute inset-0 grid place-items-center text-muted-foreground">
					<IconFileText class="size-8" aria-hidden="true" />
				</div>
			{/if}
		</ShowcaseCardPreview>
		{#if href}
			<ShowcaseCardLink {href} aria-label="{t.title}: template details" />
		{/if}
		<ShowcaseCardFooter>
			<ShowcaseCardCopy>
				<ShowcaseCardTitle class="line-clamp-1">{t.title}</ShowcaseCardTitle>
				<ShowcaseCardDescription class="line-clamp-1">
					{t.origin === "overleaf" ? `by ${t.author} · ${licence}` : `${t.documentClass} · ${licence}`}
				</ShowcaseCardDescription>
			</ShowcaseCardCopy>
			{#if action}
				<ShowcaseCardAction>{@render action()}</ShowcaseCardAction>
			{/if}
		</ShowcaseCardFooter>
	</ShowcaseCard>
</li>
