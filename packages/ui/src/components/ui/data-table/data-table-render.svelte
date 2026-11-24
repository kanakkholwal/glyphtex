<script lang="ts" generics="TContext extends object">
	import { RenderComponentConfig, RenderSnippetConfig } from "./render";

	let {
		content,
		context
	}: {
		/** A column's `header`, `cell` or `footer`: a string, or a function of the context. */
		content: string | ((context: TContext) => unknown) | undefined;
		context: TContext;
	} = $props();

	const result = $derived(typeof content === "function" ? content(context) : content);
</script>

{#if result instanceof RenderComponentConfig}
	<result.component {...result.props} />
{:else if result instanceof RenderSnippetConfig}
	{@render result.snippet(result.params)}
{:else if typeof result === "string" || typeof result === "number"}
	{result}
{/if}
