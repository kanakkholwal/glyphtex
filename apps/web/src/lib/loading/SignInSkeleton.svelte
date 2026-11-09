<script lang="ts">
	import { Skeleton } from "@glyphtex/ui/skeleton";
</script>

<!-- Mirrors SignInPanel: provider buttons, a divider, tabs, two fields and the submit button. -->
<div class="flex flex-col gap-4" role="status" aria-busy="true" aria-label="Loading sign-in">
	<div class="flex flex-col gap-2">
		<Skeleton class="h-9 w-full rounded-lg" />
		<Skeleton class="h-9 w-full rounded-lg" />
	</div>
	<Skeleton class="h-3 w-full" />
	<Skeleton class="h-9 w-full rounded-lg" />
	<div class="flex flex-col gap-3 pt-2">
		<div class="flex flex-col gap-1.5">
			<Skeleton class="h-3 w-12" />
			<Skeleton class="h-9 w-full rounded-lg" />
		</div>
		<div class="flex flex-col gap-1.5">
			<Skeleton class="h-3 w-16" />
			<Skeleton class="h-9 w-full rounded-lg" />
		</div>
		<Skeleton class="h-9 w-full rounded-lg" />
	</div>
</div>
