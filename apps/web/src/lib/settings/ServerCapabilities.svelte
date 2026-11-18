<script lang="ts">
	import { IconCheck, IconMinus } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { cloud, type ServerInfo } from "$lib/cloud/api";
	import SettingsSection from "./SettingsSection.svelte";

	let config = $state<ServerInfo | undefined>(undefined);
	onMount(
		() =>
			void cloud
				.info()
				.then((c) => (config = c))
				.catch(() => {})
	);

	const rows = $derived(
		config
			? [
					{
						name: "Email",
						on: config.features.mail,
						off: "Magic links, password resets and invitation emails are off. Set MAIL_DRIVER."
					},
					{
						name: "File storage",
						on: config.features.blobs,
						off: "Images and fonts can't be saved to the server, only text files. Set BLOB_DRIVER."
					},
					{
						name: "Live editing",
						on: config.features.live,
						detail: `Up to ${config.limits.live.maxEditors} editors per file. Idle after ${Math.round(config.limits.live.idleSeconds / 60)} minutes, sessions end after ${Math.round((config.limits.live.maxSessionSeconds / 3600) * 10) / 10} hours.`,
						off: "Not enabled on this deployment. The Node and Docker server has it built in; on Cloudflare it needs the ROOMS Durable Object binding from wrangler.jsonc."
					}
				]
			: []
	);
</script>

{#if config}
	<SettingsSection title="This server" description="What the GlyphTeX server you're connected to supports.">
		<ul class="border-border bg-background divide-border divide-y rounded-xl border">
			{#each rows as row (row.name)}
				<li class="flex items-start gap-3 p-4">
					{#if row.on}
						<IconCheck class="text-primary mt-0.5 size-4 shrink-0" />
					{:else}
						<IconMinus class="text-muted-foreground mt-0.5 size-4 shrink-0" />
					{/if}
					<div class="min-w-0">
						<p class="text-foreground text-sm font-medium">{row.name}: {row.on ? "supported" : "not supported"}</p>
						{#if !row.on}<p class="text-muted-foreground text-sm">{row.off}</p>{/if}
						{#if row.on && row.detail}<p class="text-muted-foreground text-sm">{row.detail}</p>{/if}
					</div>
				</li>
			{/each}
		</ul>
	</SettingsSection>
{/if}
