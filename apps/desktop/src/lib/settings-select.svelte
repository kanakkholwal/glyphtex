<script lang="ts" generics="T extends string">
	import { Select, SelectContent, SelectItem, SelectTrigger } from "@glyphtex/ui/select";
	import { SettingsField } from "@glyphtex/ui/settings-field";

	interface Props {
		label: string;
		description: string;
		options: readonly { value: T; label: string }[];
		value: T;
		onchange: (value: T) => void;
	}

	let { label, description, options, value, onchange }: Props = $props();

	const current = $derived(options.find((o) => o.value === value)?.label ?? value);
</script>

<div class="px-5 py-4">
	<SettingsField {label} {description} layout="row">
		<Select type="single" {value} onValueChange={(v) => onchange(v as T)}>
			<SelectTrigger class="min-w-36 text-body data-[size=default]:h-10" aria-label={label}>
				{current}
			</SelectTrigger>
			<SelectContent>
				{#each options as o (o.value)}
					<SelectItem value={o.value}>{o.label}</SelectItem>
				{/each}
			</SelectContent>
		</Select>
	</SettingsField>
</div>
