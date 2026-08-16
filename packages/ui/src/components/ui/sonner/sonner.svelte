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

<!--
  GlyphTeX Sonner theming.

  Visual contract: a toast is the same card as the app's persistent corner
  notices (engine packs, update available). Same radius, border, shadow and
  plain 16px icon; the variant is carried by the icon's colour alone, which
  measures 4.9:1 or better on the card in both themes.

  Position is bottom-right; the persistent notices sit bottom-left so the two
  stacks never overlap. Consumers can override via `<Toaster position="...">`.

  Icons are @tabler/icons-svelte (AGENTS.md rule #9). Sonner renders our snippet
  inside its `[data-icon]` element. Theme comes from the settings store, the
  single owner of that fact (no `mode-watcher`; AGENTS.md §3).
-->
<Sonner
	theme={settings.resolved}
	position="bottom-right"
	offset={16}
	mobileOffset={16}
	closeButton
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

    /* Pin the close button inside the card's top-right. Sonner's default is a
       floating circle half-outside the top-left edge, so every var that drives
       its position has to be overridden, not just the side. */
    --toast-close-button-start: unset;
    --toast-close-button-end: 0;
    --toast-close-button-transform: translate(-6px, 6px);
  "
	toastOptions={{
		classes: {
			// Width is capped, not fixed: 320px plus two 16px offsets overflows a
			// 320px phone. Border only, no ring: two edges on one card is one too many.
			toast:
				'!w-[min(320px,calc(100vw-2rem))] !rounded-lg !border !border-border !bg-card !shadow-craft-lg !p-3 !gap-2.5 !items-start',
			content: '!gap-0.5',
			// 13/12, the system's two smallest steps. Was 12.5/11.5, below the floor.
			title: '!text-[13px] !font-medium !leading-snug !text-foreground',
			description: '!text-xs !text-muted-foreground !leading-relaxed',
			// A plain glyph, not a 32px tinted badge with a ring: the badge was heavier
			// than the message and ate width the description needed.
			icon: '!size-4 !shrink-0 !m-0 !mt-0.5 !bg-transparent !ring-0',
			closeButton:
				'!size-5 !rounded-md !border-0 !bg-transparent !text-faint hover:!bg-accent hover:!text-foreground',
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
		<IconLoader2 class="size-4 animate-spin" />
	{/snippet}
	{#snippet successIcon()}
		<IconCircleCheck class="size-4" />
	{/snippet}
	{#snippet errorIcon()}
		<IconAlertOctagon class="size-4" />
	{/snippet}
	{#snippet infoIcon()}
		<IconInfoCircle class="size-4" />
	{/snippet}
	{#snippet warningIcon()}
		<IconAlertTriangle class="size-4" />
	{/snippet}
	{#snippet closeIcon()}
		<IconX class="size-3.5" />
	{/snippet}
</Sonner>
