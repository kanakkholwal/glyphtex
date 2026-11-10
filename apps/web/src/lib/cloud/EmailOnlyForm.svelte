<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { Input } from "@glyphtex/ui/input";
	import { IconLoader2 } from "@tabler/icons-svelte";
	import type { Snippet } from "svelte";

	interface Props {
		description: string;
		submitLabel: string;
		email: string;
		busy: boolean;
		error?: string;
		icon?: Snippet;
		onsubmit: () => void;
		onback: () => void;
	}

	let {
		description,
		submitLabel,
		email = $bindable(),
		busy,
		error,
		icon,
		onsubmit,
		onback
	}: Props = $props();
</script>

<form
	class="flex flex-col gap-3"
	onsubmit={(event) => {
		event.preventDefault();
		onsubmit();
	}}
>
	<p class="text-muted-foreground text-sm">{description}</p>
	<label class="flex flex-col gap-1 text-xs font-medium">
		Email
		<Input type="email" required autocomplete="email" placeholder="you@example.com" bind:value={email} />
	</label>
	{#if error}<p class="text-destructive-strong text-sm" role="alert">{error}</p>{/if}
	<Button type="submit" variant="dark" disabled={busy}>
		{#if busy}<IconLoader2 class="animate-spin" />{:else}{@render icon?.()}{/if}
		{submitLabel}
	</Button>
	<Button type="button" variant="ghost" size="sm" class="self-start" onclick={onback}>
		Back to sign in
	</Button>
</form>
