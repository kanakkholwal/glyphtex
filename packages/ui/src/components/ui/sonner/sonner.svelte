<script lang="ts">
	import { settings } from "@glyphtex/ui/settings";
	import {
		IconAlertOctagon,
		IconAlertTriangle,
		IconCircleCheck,
		IconInfoCircle,
		IconLoader2,
		IconX
	} from "@tabler/icons-svelte";
	import { Toaster as Sonner, type ToasterProps as SonnerProps } from "svelte-sonner";

	let { ...restProps }: SonnerProps = $props();
</script>

<!-- Same card as the corner notices, which sit bottom-left so the stacks never overlap.
     Theme comes from the settings store; each variant carries a glyph and a screen-reader word. -->
<Sonner
	theme={settings.resolved}
	position="bottom-right"
	offset={16}
	mobileOffset={16}
	closeButton
	duration={5000}
	gap={8}
	class="toaster group"
	style="
    --normal-bg: var(--color-card);
    --normal-text: var(--color-foreground);
    --normal-border: var(--color-border);

    --success-bg: var(--color-card);
    --success-text: var(--color-foreground);
    --success-border: var(--color-border);

    --error-bg: var(--color-card);
    --error-text: var(--color-foreground);
    --error-border: var(--color-border);

    --warning-bg: var(--color-card);
    --warning-text: var(--color-foreground);
    --warning-border: var(--color-border);

    --info-bg: var(--color-card);
    --info-text: var(--color-foreground);
    --info-border: var(--color-border);

    /* Pins the close button inside the top-right; every position var needs overriding. */
    --toast-close-button-start: unset;
    --toast-close-button-end: 0;
    --toast-close-button-transform: translate(-6px, 6px);
  "
	toastOptions={{
		classes: {
			// Capped, not fixed: 320px plus two 16px offsets overflows a 320px phone.
			toast:
				'!w-[min(320px,calc(100vw-2rem))] !rounded-xl !border !border-border !bg-card !shadow-lg !p-3 !gap-2.5 !items-start',
			content: '!gap-0.5',
			title: '!text-sm !font-medium !leading-snug !text-foreground',
			description: '!text-xs !text-muted-foreground !leading-relaxed',
			// A plain glyph: a tinted badge outweighed the message and ate its width.
			icon: '!size-4 !shrink-0 !m-0 !mt-0.5 !bg-transparent !ring-0',
			closeButton:
				'!size-6 !rounded-md !border-0 !bg-transparent !text-muted-foreground hover:!bg-accent hover:!text-foreground',
			actionButton: '!text-xs !font-medium',
			cancelButton: '!text-xs !text-muted-foreground',
			success: '[&_[data-icon]]:!text-success',
			error: '[&_[data-icon]]:!text-destructive',
			warning: '[&_[data-icon]]:!text-warning',
			info: '[&_[data-icon]]:!text-info'
		}
	}}
	{...restProps}
>
	{#snippet loadingIcon()}
		<IconLoader2 class="size-4 animate-spin" /><span class="sr-only">Loading:</span>
	{/snippet}
	{#snippet successIcon()}
		<IconCircleCheck class="size-4" /><span class="sr-only">Success:</span>
	{/snippet}
	{#snippet errorIcon()}
		<IconAlertOctagon class="size-4" /><span class="sr-only">Error:</span>
	{/snippet}
	{#snippet infoIcon()}
		<IconInfoCircle class="size-4" /><span class="sr-only">Info:</span>
	{/snippet}
	{#snippet warningIcon()}
		<IconAlertTriangle class="size-4" /><span class="sr-only">Warning:</span>
	{/snippet}
	{#snippet closeIcon()}
		<IconX class="size-3.5" />
	{/snippet}
</Sonner>
