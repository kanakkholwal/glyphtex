<script lang="ts">
	let { d, class: classProp }: { d: string; class?: string } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class={classProp}
>
	<path {d} />
</svg>
