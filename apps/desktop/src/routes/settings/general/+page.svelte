<script lang="ts">
	import { Select, SelectContent, SelectItem, SelectTrigger } from '@glyphx/ui/select';
	import { SettingsField } from '@glyphx/ui/settings-field';
	import { settings, type Appearance, type SidebarPosition } from '@glyphx/ui/settings';

	const appearanceOpts: { value: Appearance; label: string }[] = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'system', label: 'System' }
	];
	const sidebarOpts: { value: SidebarPosition; label: string }[] = [
		{ value: 'left', label: 'Left' },
		{ value: 'right', label: 'Right' }
	];
</script>

<!-- A single-choice row: label + description on the left, a compact dropdown on
     the right. Shared shape for every select-backed setting on this page. -->
{#snippet selectRow(
	label: string,
	description: string,
	opts: readonly { value: string; label: string }[],
	current: string,
	onChange: (v: string) => void
)}
	<div class="px-4 py-3.5">
		<SettingsField {label} {description} layout="row">
			<Select type="single" value={current} onValueChange={onChange}>
				<SelectTrigger size="sm" class="min-w-[9rem]" aria-label={label}>
					{opts.find((o) => o.value === current)?.label ?? current}
				</SelectTrigger>
				<SelectContent>
					{#each opts as o (o.value)}
						<SelectItem value={o.value}>{o.label}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</SettingsField>
	</div>
{/snippet}

<div class="flex max-w-2xl flex-col gap-8">
	<header>
		<h2 class="font-display text-xl font-semibold tracking-tight">General</h2>
		<p class="text-muted-foreground mt-1.5 text-sm">Appearance and app-wide preferences.</p>
	</header>

	<section class="flex flex-col gap-2.5">
		<h3 class="text-muted-foreground px-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
			Appearance
		</h3>
		<div class="bg-card border-border divide-border/60 divide-y overflow-hidden rounded-xl border">
			{@render selectRow(
				'Theme',
				'Follow the system theme, or pick light / dark.',
				appearanceOpts,
				settings.appearance,
				(v) => (settings.appearance = v as Appearance)
			)}
			{@render selectRow(
				'Side panel',
				'Which side the activity bar and side panel dock on.',
				sidebarOpts,
				settings.sidebarPosition,
				(v) => (settings.sidebarPosition = v as SidebarPosition)
			)}
		</div>
	</section>
</div>
