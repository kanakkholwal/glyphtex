<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "../../../lib/cn.js";
	import Progress from "../../ui/progress/progress.svelte";
	import Spinner from "../../ui/spinner/spinner.svelte";
	import {
		type LoadingScreenIndicator,
		type LoadingScreenLogoMotion,
		type LoadingScreenPosition,
		loadingScreen,
		statusLabel
	} from "./variants";

	let {
		logo,
		open = true,
		progress,
		indicator = "bar",
		logoMotion,
		position,
		caption,
		label = "Loading",
		class: className
	}: {
		/** Your mark, e.g. an inline SVG. Omit for an indicator-only screen. */
		logo?: Snippet;
		/** Visible while true; false fades it out and makes it inert. */
		open?: boolean;
		/** 0-100 for a determinate bar; omit for an indeterminate one. */
		progress?: number;
		indicator?: LoadingScreenIndicator;
		logoMotion?: LoadingScreenLogoMotion;
		/** `fixed` covers the page; `absolute` covers the nearest positioned container. */
		position?: LoadingScreenPosition;
		/** Short visible line under the indicator. */
		caption?: Snippet;
		/** Screen-reader status text. */
		label?: string;
		class?: string;
	} = $props();

	const s = $derived(loadingScreen({ position, logoMotion, indicator, open }));
</script>

<div
	data-slot="loading-screen"
	role="status"
	inert={!open}
	class={cn(s.root(), className)}
>
	<span class={s.srOnly()}>{statusLabel(label, progress)}</span>
	{#if logo}
		<div aria-hidden="true" class={s.logo()}>{@render logo()}</div>
	{/if}
	{#if indicator !== "none"}
		<div aria-hidden="true" class={s.indicator()}>
			{#if indicator === "bar"}
				<Progress value={progress ?? 0} indeterminate={progress === undefined} size="sm" class="w-28" />
			{:else if indicator === "spinner"}
				<Spinner size="default" {label} />
			{:else}
				<span class={s.dots()}>
					{#each [0, 1, 2] as i (i)}
						<span class={s.dot()} style:animation-delay="{i * 160}ms"></span>
					{/each}
				</span>
			{/if}
		</div>
	{/if}
	{#if caption}
		<div class={s.caption()}>{@render caption()}</div>
	{/if}
</div>
