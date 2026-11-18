<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { live } from "@glyphtex/ui/live";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconUsers } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import type { DocumentMeta } from "$lib/documents/store";
	import { SERVER_URL } from "./config";
	import { publicConfig } from "./public-config";
	import { cloudSession } from "./session.svelte";

	let { document }: { document: DocumentMeta } = $props();

	// Cursor colours the editor can show next to a name; picked from the user id so it stays stable.
	const COLORS = ["#0f6fde", "#d9481c", "#1a8f5c", "#a23bd1", "#c28a00", "#cc3c6e"];
	const colorOf = (id: string) =>
		COLORS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % COLORS.length] as string;

	const on = $derived(live.config !== null);
	// Unknown until the server answers; only a definite no disables the button.
	let supported = $state<boolean | undefined>(undefined);
	onMount(
		() =>
			void publicConfig()
				.then((c) => (supported = c.features.live))
				.catch(() => {})
	);
	const available = $derived(Boolean(document.remoteId) && cloudSession.signedIn);

	function toggle() {
		if (on) {
			live.config = null;
			return;
		}
		const user = cloudSession.user;
		const remoteId = document.remoteId;
		if (!user || !remoteId) return;
		const base = SERVER_URL.replace(/^http/, "ws");
		live.config = {
			url: (path) =>
				`${base}/api/projects/${encodeURIComponent(remoteId)}/files/live?path=${encodeURIComponent(path)}`,
			person: { name: user.name || user.email, color: colorOf(user.id) }
		};
	}

	// Turn the switch back off when the server can't host it, with one plain-language message.
	$effect(() => {
		if (live.status === "unavailable") {
			live.config = null;
			toast.info("Live editing isn't available on this server. Edits still sync normally.");
		}
	});

	// Leaving the document must not leave the next one live.
	$effect(() => () => {
		live.config = null;
	});

	const status = $derived(
		live.status === "live"
			? "Live"
			: live.status === "connecting" || live.status === "offline"
				? "Connecting…"
				: ""
	);
</script>

{#if available}
	<Button
		variant={on ? "dark" : "outline"}
		size="sm"
		onclick={toggle}
		aria-pressed={on}
		disabled={supported === false}
		title={supported === false
			? "This server doesn't have live editing enabled. On Cloudflare it needs the ROOMS Durable Object binding."
			: undefined}
	>
		<IconUsers />
		{on ? (status || "Live") : "Edit live"}
	</Button>
{/if}
