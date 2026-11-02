<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import { templatePath, templatePreview } from "$lib/templates";
	import { TemplateCard } from "@glyphtex/ui/application";
	import { Button } from "@glyphtex/ui/button";
	import type { ProjectTemplate } from "@glyphtex/ui/project-templates";
	import { IconArrowRight } from "@tabler/icons-svelte";

	let {
		template: t,
		location,
		priority = false
	}: { template: ProjectTemplate; location: string; priority?: boolean } = $props();

	const useHref = $derived(`${resolve("/workspace/templates")}?use=${encodeURIComponent(t.id)}`);
	const pageHref = $derived((resolve as (route: string) => string)(templatePath(t.id)));
</script>

<TemplateCard template={t} preview={templatePreview(t.id)} href={pageHref} {priority}>
	{#snippet action()}
		<Button
			href={useHref}
			variant="outline"
			size="sm"
			aria-label="Use the {t.title} template"
			onclick={() => track("cta_clicked", { target: "template", location })}
		>
			Use
			<IconArrowRight />
		</Button>
	{/snippet}
</TemplateCard>
