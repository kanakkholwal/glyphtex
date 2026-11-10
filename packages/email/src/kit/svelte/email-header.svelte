<script lang="ts">
	import { Img, Text } from "@better-svelte-email/components";
	import { type EmailHeaderAlign, type EmailHeaderVariant, emailHeader } from "../variants";

	let {
		brand,
		logo,
		logoWidth = 32,
		variant = "lockup",
		align = "left"
	}: {
		brand: string;
		/** Absolute PNG or JPG URL, 32px tall; SVG does not render in Gmail or Outlook. */
		logo?: string;
		/** Rendered width of `logo`: 32 for a square mark, wider for a `logo` wordmark. */
		logoWidth?: number;
		/** `lockup` sets the name beside a square mark; `logo` shows a wordmark image alone. */
		variant?: EmailHeaderVariant;
		align?: EmailHeaderAlign;
	} = $props();

	const s = $derived(emailHeader({ variant, align }));
</script>

<Text class={s.root()}>
	{#if logo}<Img
			src={logo}
			alt={variant === "logo" ? brand : ""}
			role={variant === "logo" ? undefined : "presentation"}
			width={String(logoWidth)}
			height="32"
			class={s.logo()}
		/>{/if}{#if !(logo && variant === "logo")}<span class={s.name()}>{brand}</span>{/if}
</Text>
