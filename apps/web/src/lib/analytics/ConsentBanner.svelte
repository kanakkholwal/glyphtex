<script lang="ts">
	import { resolve } from "$app/paths";
	import { Button } from "@glyphtex/ui/button";
	import { onMount } from "svelte";
	import { fly } from "svelte/transition";
	import { prefersReducedMotion } from "svelte/motion";

	import { analyticsConfigured, consentChoice, setConsent } from "./index";

	// Null until mounted: the choice lives in browser storage, which SSR cannot read.
	let choice = $state<ReturnType<typeof consentChoice> | undefined>(undefined);
	let configured = $state(false);

	onMount(() => {
		configured = analyticsConfigured();
		choice = consentChoice();
	});

	function decide(value: "granted" | "denied") {
		setConsent(value);
		choice = value;
	}
</script>

{#if configured && choice === null}
	<aside
		aria-label="Analytics consent"
		class="border-border bg-background fixed bottom-4 left-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 rounded-xl border p-4 shadow-(--surface-shadow)"
		in:fly={{ y: prefersReducedMotion.current ? 0 : 12, duration: 180 }}
	>
		<p class="text-sm font-medium text-foreground">Analytics</p>
		<p class="text-muted-foreground text-sm text-pretty">
			Allow anonymous usage analytics (Google Analytics)? Nothing is sent unless you say yes, and your
			documents are never included.
			<a href={resolve("/privacy")} class="text-foreground underline underline-offset-4">Details</a>
		</p>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" class="flex-1" onclick={() => decide("denied")}>Decline</Button>
			<Button variant="dark" size="sm" class="flex-1" onclick={() => decide("granted")}>Allow</Button>
		</div>
	</aside>
{/if}
