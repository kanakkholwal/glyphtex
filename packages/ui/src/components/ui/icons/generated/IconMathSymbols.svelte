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
><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12h18m-9-9v18m4.5-16.5l3 3m0-3l-3 3M6 4v4M4 6h4m10 10h.01M18 20h.01M4 18h4"/></svg>
