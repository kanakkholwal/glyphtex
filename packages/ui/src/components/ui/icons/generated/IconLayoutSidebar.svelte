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
><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm5-2v16"/></svg>
