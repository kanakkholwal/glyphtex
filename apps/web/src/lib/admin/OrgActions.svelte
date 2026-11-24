<script lang="ts">
	import { Button } from "@glyphtex/ui/button";

	import type { AdminOrg } from "$lib/cloud/api";

	let { org, onedit }: { org: AdminOrg; onedit: (org: AdminOrg) => void } = $props();
</script>

<Button variant="ghost" size="sm" onclick={() => onedit(org)} aria-label="Edit {org.name}">Edit</Button>
