<script lang="ts">
	import { Badge } from "@glyphtex/ui/badge";

	import type { AdminUser } from "./users";

	let { user }: { user: AdminUser } = $props();
</script>

<div class="flex flex-wrap gap-1">
	{#if user.role === "admin"}<Badge variant="default">Admin</Badge>{/if}
	{#if user.banned}
		<Badge variant="destructive">Banned</Badge>
	{:else if !user.emailVerified}
		<Badge variant="warning">Unverified</Badge>
	{:else}
		<Badge variant="success">Active</Badge>
	{/if}
</div>
