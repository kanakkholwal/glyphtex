<script lang="ts">
	import type { ComponentRegistry, RenderOutput } from "@docvia/renderer-core";
	import type { Component } from "svelte";
	import Self from "./DocviaRenderer.svelte";

	// Vendored from @docvia/renderer-svelte: that package ships a raw dist/*.svelte
	// with a dangling `svelte` export condition, which breaks SSR (dev and build).
	// Depending only on @docvia/renderer-core (pure TS) sidesteps it.
	type Props = { nodes: RenderOutput | RenderOutput[]; registry?: ComponentRegistry };

	let { nodes, registry }: Props = $props();

	const list = $derived(Array.isArray(nodes) ? nodes : [nodes]);

	const asComponent = (value: unknown): Component => value as Component;
</script>

{#each list as node (node)}
	{#if node?.kind === "text"}
		{node.value}
	{:else if node?.kind === "html"}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html node.value}
	{:else if node?.kind === "element"}
		<svelte:element this={node.tag} {...node.props} data-hid={node.id}>
			{#if node.children}<Self nodes={node.children} {registry} />{/if}
		</svelte:element>
	{:else if node?.kind === "component"}
		{@const resolved = registry?.resolve(node.name)}
		{#if resolved}
			{@const Dynamic = asComponent(resolved.component)}
			<Dynamic {...node.props || {}}>
				{#if node.children}<Self nodes={node.children} {registry} />{/if}
			</Dynamic>
		{:else}
			<div class="docvia-error">Unknown component: {node.name}</div>
		{/if}
	{:else if node?.kind === "fragment"}
		<Self nodes={node.children} {registry} />
	{/if}
{/each}
