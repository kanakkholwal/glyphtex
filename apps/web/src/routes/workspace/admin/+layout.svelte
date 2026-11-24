<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { Button } from "@glyphtex/ui/button";
	import {
		Empty,
		EmptyContent,
		EmptyDescription,
		EmptyHeader,
		EmptyTitle
	} from "@glyphtex/ui/empty";
	import { Spinner } from "@glyphtex/ui/spinner";
	import { Toaster } from "@glyphtex/ui/sonner";
	import { IconArrowLeft } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { CloudError, cloud } from "$lib/cloud/api";

	let { children } = $props();

	const links = [
		{ href: "/workspace/admin", label: "Overview" },
		{ href: "/workspace/admin/users", label: "Users" },
		{ href: "/workspace/admin/organizations", label: "Organizations" },
		{ href: "/workspace/admin/audit", label: "Audit log" },
		{ href: "/workspace/admin/system", label: "System" }
	];

	// The server answers 404 to everyone who is not an instance admin, so the page never says it exists.
	let access = $state<"checking" | "granted" | "denied">("checking");

	onMount(async () => {
		try {
			await cloud.admin.health();
			access = "granted";
		} catch (error) {
			// An admin whose address is not verified is sent to verify it instead of to a dead end.
			if (error instanceof CloudError && error.code === "email_unverified") {
				void goto("/workspace/verify-email?next=/workspace/admin", { replaceState: true });
				return;
			}
			access = "denied";
		}
	});

	const active = (href: string) =>
		href === "/workspace/admin"
			? page.url.pathname.replace(/\/$/, "") === href
			: page.url.pathname.startsWith(href);
</script>

<svelte:head><title>Admin · GlyphTeX</title></svelte:head>

{#if access === "checking"}
	<div class="grid min-h-dvh place-items-center"><Spinner /></div>
{:else if access === "denied"}
	<div class="grid min-h-dvh place-items-center p-6">
		<Empty>
			<EmptyHeader>
				<EmptyTitle>Page not found</EmptyTitle>
				<EmptyDescription>There is nothing at this address.</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button href="/workspace" variant="dark" size="sm">Back to projects</Button>
			</EmptyContent>
		</Empty>
	</div>
{:else}
	<div class="bg-background min-h-dvh">
		<header class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 pt-8">
			<Button href="/workspace" variant="ghost" size="icon-sm" aria-label="Back to workspace">
				<IconArrowLeft />
			</Button>
			<h1 class="font-display text-2xl">Instance admin</h1>
			<nav class="ml-auto flex flex-wrap gap-1" aria-label="Admin sections">
				{#each links as link (link.href)}
					<Button
						href={link.href}
						variant={active(link.href) ? "secondary" : "ghost"}
						size="sm"
						aria-current={active(link.href) ? "page" : undefined}
					>
						{link.label}
					</Button>
				{/each}
			</nav>
		</header>
		<main class="mx-auto max-w-6xl px-6 py-8">
			{@render children()}
		</main>
	</div>
	<Toaster />
{/if}
