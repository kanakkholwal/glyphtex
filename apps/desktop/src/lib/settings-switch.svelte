<script lang="ts">
	import { SettingsField } from "@glyphtex/ui/settings-field";
	import { Switch } from "@glyphtex/ui/switch";
	import type { Snippet } from "svelte";

	interface Props {
		label: string;
		description: string;
		checked: boolean;
		disabled?: boolean;
		onchange: (checked: boolean) => void;
		/** Shown before the switch, e.g. a status badge. */
		status?: Snippet;
	}

	let { label, description, checked, disabled = false, onchange, status }: Props = $props();
</script>

<div class="px-5 py-4">
	<SettingsField {label} {description} layout="row">
		<div class="flex items-center gap-3">
			{@render status?.()}
			<Switch {checked} {disabled} onCheckedChange={onchange} aria-label={label} />
		</div>
	</SettingsField>
</div>
