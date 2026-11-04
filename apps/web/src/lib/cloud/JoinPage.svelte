<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { Button } from "@glyphtex/ui/button";
	import { IconLoader2 } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import type { Joined } from "@glyphtex/server/contract";
	import CloudPage from "./CloudPage.svelte";
	import { cloudEnabled, cloudHref } from "./config";
	import { cloudSession } from "./session.svelte";

	interface Props {
		/** "invite" tokens are bound to an email; "link" tokens to whoever holds them. */
		kind: "invite" | "link";
		redeem: (token: string) => Promise<Joined>;
	}

	let { kind, redeem }: Props = $props();

	let phase = $state<"checking" | "signin" | "joining" | "error">("checking");
	let error = $state("");

	onMount(async () => {
		if (!cloudEnabled) {
			phase = "error";
			error = "This GlyphTeX has no server configured, so it can't open shared projects.";
			return;
		}
		await cloudSession.refresh();
		if (!cloudSession.signedIn) {
			phase = "signin";
			return;
		}
		phase = "joining";
		try {
			const joined = await redeem(page.params.token ?? "");
			void goto(cloudHref(joined.projectId), { replaceState: true });
		} catch (e) {
			phase = "error";
			error = e instanceof Error ? e.message : "Could not open this project.";
		}
	});

	const signInHref = $derived(
		`${resolve("/workspace/account")}?next=${encodeURIComponent(page.url.pathname)}`
	);
</script>

{#if phase === 'signin'}
	<CloudPage
		title={kind === 'invite' ? "You've been invited to a project" : 'Open a shared project'}
		description={kind === 'invite'
			? 'Sign in with the email address the invite was sent to.'
			: 'Sign in or create an account to open it.'}
	>
		<Button variant="dark" href={signInHref}>Sign in to continue</Button>
	</CloudPage>
{:else if phase === 'error'}
	<CloudPage title="Can't open this project" description={error}>
		<Button variant="dark" href={resolve('/workspace')}>Back to projects</Button>
	</CloudPage>
{:else}
	<CloudPage title="Opening project">
		<p class="text-muted-foreground flex items-center gap-2 text-sm" role="status">
			<IconLoader2 size={14} class="animate-spin" /> Joining…
		</p>
	</CloudPage>
{/if}
