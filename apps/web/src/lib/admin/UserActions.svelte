<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from "@glyphtex/ui/dropdown-menu";
	import { IconDots } from "@tabler/icons-svelte";

	import type { AdminUser, UserAction } from "./users";

	let {
		user,
		onaction
	}: { user: AdminUser; onaction: (action: UserAction, user: AdminUser) => void } = $props();
</script>

<DropdownMenu>
	<DropdownMenuTrigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon-sm" aria-label="Actions for {user.email}">
				<IconDots />
			</Button>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="end" class="w-52">
		<DropdownMenuItem onSelect={() => onaction("impersonate", user)}>View as this user</DropdownMenuItem>
		<DropdownMenuItem onSelect={() => onaction("sign-out", user)}>Sign out everywhere</DropdownMenuItem>
		<DropdownMenuSeparator />
		{#if user.role === "admin"}
			<DropdownMenuItem onSelect={() => onaction("remove-admin", user)}>Remove admin</DropdownMenuItem>
		{:else}
			<DropdownMenuItem onSelect={() => onaction("make-admin", user)}>Make admin</DropdownMenuItem>
		{/if}
		{#if user.banned}
			<DropdownMenuItem onSelect={() => onaction("unban", user)}>Unban</DropdownMenuItem>
		{:else}
			<DropdownMenuItem onSelect={() => onaction("ban", user)}>Ban</DropdownMenuItem>
		{/if}
		<DropdownMenuSeparator />
		<DropdownMenuItem destructive onSelect={() => onaction("delete", user)}>Delete account</DropdownMenuItem>
	</DropdownMenuContent>
</DropdownMenu>
