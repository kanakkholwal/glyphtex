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
><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2m0 9l2 2l4-4"/></g></svg>
