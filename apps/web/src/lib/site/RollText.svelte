<script lang="ts">
	/** Text that rolls up on hover or focus. The parent link carries `group/roll`. */
	let { text }: { text: string } = $props();
</script>

<span class="relative inline-flex overflow-hidden align-bottom">
	<span
		class="block transition-transform duration-(--duration-roll) ease-(--ease-out) group-hover/roll:-translate-y-full group-focus-visible/roll:-translate-y-full motion-reduce:transition-none"
	>
		{text}
	</span>
	<span
		aria-hidden="true"
		class="absolute inset-0 block translate-y-full transition-transform duration-(--duration-roll) ease-(--ease-out) group-hover/roll:translate-y-0 group-focus-visible/roll:translate-y-0 motion-reduce:transition-none"
	>
		{text}
	</span>
</span>
