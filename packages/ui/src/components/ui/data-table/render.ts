import type { Component, Snippet } from "svelte";

export class RenderComponentConfig<TProps extends Record<string, unknown>> {
	constructor(
		readonly component: Component<TProps>,
		readonly props: TProps
	) {}
}

export class RenderSnippetConfig<TParams> {
	constructor(
		readonly snippet: Snippet<[TParams]>,
		readonly params: TParams
	) {}
}

/** Returns a component from a column's `header` or `cell`, e.g. `renderComponent(Badge, {...})`. */
export function renderComponent<TProps extends Record<string, unknown>>(
	component: Component<TProps>,
	props: TProps
) {
	return new RenderComponentConfig(component, props);
}

/** Returns a one-parameter snippet from a column's `header` or `cell`. */
export function renderSnippet<TParams>(snippet: Snippet<[TParams]>, params: TParams) {
	return new RenderSnippetConfig(snippet, params);
}
