<script lang="ts">
	import { Select, SelectContent, SelectItem, SelectTrigger } from "@glyphtex/ui/select";
	import type { GrantableRole } from "./api";

	interface Props {
		value: GrantableRole;
		onchange: (role: GrantableRole) => void;
		label: string;
		disabled?: boolean;
	}

	let { value, onchange, label, disabled = false }: Props = $props();

	const ROLE_OPTIONS: { value: GrantableRole; label: string; hint: string }[] = [
		{ value: "editor", label: "Editor", hint: "Can edit files" },
		{ value: "commenter", label: "Commenter", hint: "Can view and comment" },
		{ value: "viewer", label: "Viewer", hint: "Can view" }
	];
</script>

<Select bind:value={() => value, (v) => onchange(v as GrantableRole)} {disabled}>
	<SelectTrigger size="sm" class="w-auto min-w-28 shrink-0 text-xs" aria-label={label}>
		{ROLE_OPTIONS.find((o) => o.value === value)?.label ?? value}
	</SelectTrigger>
	<SelectContent>
		{#each ROLE_OPTIONS as o (o.value)}
			<SelectItem value={o.value}>
				<span class="flex flex-col">
					<span>{o.label}</span>
					<span class="text-muted-foreground text-xs">{o.hint}</span>
				</span>
			</SelectItem>
		{/each}
	</SelectContent>
</Select>
