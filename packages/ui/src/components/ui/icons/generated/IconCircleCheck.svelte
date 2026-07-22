<script lang="ts">
  import type { SVGAttributes } from "svelte/elements";
  let {
    size = 18,
    class: className = undefined,
    ...rest
  }: { size?: number | string; class?: string } & SVGAttributes<SVGSVGElement> = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  class={className}
  aria-hidden="true"
  {...rest}
><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0"/><path d="m9 12l2 2l4-4"/></g></svg>
