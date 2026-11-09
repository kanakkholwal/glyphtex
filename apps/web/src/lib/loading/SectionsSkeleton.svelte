<script lang="ts">
	import { Skeleton } from "@glyphtex/ui/skeleton";
	import RowsSkeleton from "./RowsSkeleton.svelte";

	interface Props {
		sections?: number;
		label?: string;
	}

	let { sections = 2, label = "Loading" }: Props = $props();
</script>

<!-- The shape of SettingsSection: a heading, a line of help, then a framed card. -->
<div class="flex flex-col gap-10" role="status" aria-busy="true" aria-label={label}>
	{#each { length: sections } as _, i (i)}
		<section class="flex flex-col gap-4">
			<div class="flex flex-col gap-2">
				<Skeleton class="h-4 w-40" />
				<Skeleton class="h-3.5 w-2/3 max-w-md" />
			</div>
			<RowsSkeleton rows={i === 0 ? 1 : 2} {label} />
		</section>
	{/each}
</div>
