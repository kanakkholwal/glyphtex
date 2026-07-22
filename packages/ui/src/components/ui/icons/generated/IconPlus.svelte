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
><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m-7-7h14"/></svg>
