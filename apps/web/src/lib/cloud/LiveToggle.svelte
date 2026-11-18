<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { live } from "@glyphtex/ui/live";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconUsers } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import type { DocumentMeta } from "$lib/documents/store";
	import { SERVER_URL } from "./config";
	import { cloud, type ServerInfo } from "./api";
	import { cloudSession } from "./session.svelte";

	let { document }: { document: DocumentMeta } = $props();

	// Cursor colours the editor can show next to a name; picked from the user id so it stays stable.
	const COLORS = ["#0f6fde", "#d9481c", "#1a8f5c", "#a23bd1", "#c28a00", "#cc3c6e"];
	const colorOf = (id: string) =>
		COLORS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % COLORS.length] as string;

	const on = $derived(live.config !== null);
	// Unknown until the server answers; only a definite no disables the button.
	let info = $state<ServerInfo | undefined>(undefined);
	const supported = $derived(info ? info.features.live : undefined);
	const limits = $derived(info?.limits.live);
	onMount(
		() =>
			void cloud
				.info()
				.then((i) => (info = i))
				.catch(() => {})
	);

	const minutes = (seconds: number) => Math.round(seconds / 60);
	const hours = (seconds: number) => Math.round((seconds / 3600) * 10) / 10;
	const limitText = $derived(
		limits
			? `Up to ${limits.maxEditors} people per file. Disconnects after ${minutes(limits.idleSeconds)} minutes without typing, and sessions last up to ${hours(limits.maxSessionSeconds)} hours. Edits keep syncing normally either way.`
			: undefined
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
			person: { name: user.name || user.email, color: colorOf(user.id) },
			idleSeconds: limits?.idleSeconds
		};
	}

	// When the server ends or refuses a session, switch off and say exactly why and what the limit is.
	$effect(() => {
		const status = live.status;
		const reason =
			status === "unavailable"
				? "Live editing isn't available right now: this server doesn't host it or has reached its daily platform limit. Edits still sync normally."
				: status === "full"
					? `This file already has the maximum of ${limits?.maxEditors ?? "the allowed number of"} people editing live. Try again when someone leaves; edits still sync normally.`
					: status === "idle"
						? `Live editing paused after ${limits ? minutes(limits.idleSeconds) : "a few"} minutes without typing, to free the room. Press Edit live to rejoin.`
						: status === "session"
							? `The live session reached its ${limits ? hours(limits.maxSessionSeconds) : "time"} hour limit. Press Edit live to start a new one.`
							: undefined;
		if (!reason) return;
		live.config = null;
		toast.info(reason);
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
			: limitText}
	>
		<IconUsers />
		{on ? (status || "Live") : "Edit live"}
	</Button>
{/if}
