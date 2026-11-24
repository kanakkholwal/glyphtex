<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { Button } from "@glyphtex/ui/button";
	import { Field, FieldDescription, FieldError, FieldLabel } from "@glyphtex/ui/field";
	import { Input } from "@glyphtex/ui/input";
	import { Progress } from "@glyphtex/ui/progress";
	import { Textarea } from "@glyphtex/ui/textarea";
	import { ToggleGroup, ToggleGroupItem } from "@glyphtex/ui/toggle-group";
	import { toast } from "@glyphtex/ui/sonner";
	import {
		IconArrowRight,
		IconBuilding,
		IconCheck,
		IconLoader2,
		IconUser
	} from "@tabler/icons-svelte";
	import { onMount } from "svelte";
	import { fly } from "svelte/transition";
	import { prefersReducedMotion } from "svelte/motion";

	import AuthShell from "$lib/cloud/AuthShell.svelte";
	import { authClient, unwrap } from "$lib/cloud/auth";
	import { cloudEnabled } from "$lib/cloud/config";
	import { cloudSession, type OrgSummary } from "$lib/cloud/session.svelte";

	type Step = "use" | "org" | "invite" | "start";

	// A team sign-up arrives with intent=team and skips the question it already answered.
	const arrivedAsTeam = page.url.searchParams.get("intent") === "team";
	let step = $state<Step>(arrivedAsTeam ? "org" : "use");
	let team = $state(arrivedAsTeam);
	let ready = $state(false);

	onMount(async () => {
		if (!cloudEnabled) {
			void goto("/workspace", { replaceState: true });
			return;
		}
		await cloudSession.ensure();
		if (!cloudSession.signedIn) {
			void goto("/workspace/sign-in?mode=signup&next=/workspace/welcome", { replaceState: true });
			return;
		}
		ready = true;
	});

	const steps = $derived<Step[]>(team ? ["use", "org", "invite", "start"] : ["use", "start"]);
	const position = $derived(steps.indexOf(step));
	const percent = $derived(((position + 1) / steps.length) * 100);

	const COPY: Record<Step, { title: string; description: string }> = {
		use: {
			title: `Welcome${cloudSession.user?.name ? `, ${cloudSession.user.name.split(" ")[0]}` : ""}`,
			description: "Two questions and you are writing. How will you use GlyphTeX?"
		},
		org: {
			title: "Name your organization",
			description: "A shared space for a lab, department or company. You become its owner."
		},
		invite: {
			title: "Invite your people",
			description: "They get an email with a link. You can add more later in Settings."
		},
		start: {
			title: "You are all set",
			description: "Start a document, or pick a template that matches your venue."
		}
	};

	let orgName = $state("");
	let org = $state<OrgSummary>();
	let busy = $state(false);
	let error = $state<string | undefined>();

	async function createOrg(event: SubmitEvent) {
		event.preventDefault();
		const name = orgName.trim();
		if (!name) return;
		busy = true;
		error = undefined;
		try {
			org = await cloudSession.createOrg(name);
			step = "invite";
		} catch (e) {
			error = e instanceof Error ? e.message : "Could not create the organization.";
		} finally {
			busy = false;
		}
	}

	let emails = $state("");
	let role = $state<"member" | "admin">("member");
	const parsed = $derived(
		[...new Set(emails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()))].filter((e) =>
			/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
		)
	);

	async function invite(event: SubmitEvent) {
		event.preventDefault();
		if (!org || parsed.length === 0) return;
		busy = true;
		error = undefined;
		const failed: string[] = [];
		for (const email of parsed) {
			try {
				await unwrap(authClient.organization.inviteMember({ email, role, organizationId: org.id }));
			} catch {
				failed.push(email);
			}
		}
		busy = false;
		if (failed.length) {
			error = `We could not invite ${failed.join(", ")}. Check the addresses and try again.`;
			emails = failed.join("\n");
			return;
		}
		toast.success(`${parsed.length} invitation${parsed.length === 1 ? "" : "s"} sent.`);
		step = "start";
	}

	const enter = () => ({ y: prefersReducedMotion.current ? 0 : 6, duration: 160 });
</script>

<AuthShell title={COPY[step].title} description={COPY[step].description}>
	{#if !ready}
		<div class="flex justify-center py-8" role="status" aria-label="Loading"><IconLoader2 class="animate-spin" /></div>
	{:else}
		<div class="flex flex-col gap-2">
			<p class="text-muted-foreground text-xs tabular-nums">Step {position + 1} of {steps.length}</p>
			<Progress value={percent} />
		</div>

		{#key step}
			<div class="flex flex-col gap-4" in:fly={enter()}>
				{#if step === "use"}
					<div class="grid gap-3">
						<button
							type="button"
							class="bg-tint hover:bg-tint-hover ease-(--ease-out) flex items-start gap-3 rounded-2xl p-4 text-left transition-colors duration-(--duration-fast)"
							onclick={() => {
								team = false;
								step = "start";
							}}
						>
							<IconUser class="mt-0.5 size-5 shrink-0" />
							<span>
								<span class="block font-medium">Just me</span>
								<span class="text-muted-foreground text-sm">Write and keep your own papers. You can add a team later.</span>
							</span>
						</button>
						<button
							type="button"
							class="bg-tint hover:bg-tint-hover ease-(--ease-out) flex items-start gap-3 rounded-2xl p-4 text-left transition-colors duration-(--duration-fast)"
							onclick={() => {
								team = true;
								step = "org";
							}}
						>
							<IconBuilding class="mt-0.5 size-5 shrink-0" />
							<span>
								<span class="block font-medium">My team or organization</span>
								<span class="text-muted-foreground text-sm">A shared space with roles, templates and single sign-on.</span>
							</span>
						</button>
					</div>
				{:else if step === "org"}
					<form class="flex flex-col gap-4" onsubmit={createOrg}>
						<Field>
							<FieldLabel for="org-name">Organization name</FieldLabel>
							<Input id="org-name" required maxlength={80} placeholder="Physics Lab" bind:value={orgName} />
							<FieldDescription>Shown to members and on invitations.</FieldDescription>
						</Field>
						{#if error}<FieldError role="alert">{error}</FieldError>{/if}
						<Button type="submit" variant="dark" disabled={busy || !orgName.trim()}>
							{#if busy}<IconLoader2 class="animate-spin" />{/if} Create organization
						</Button>
					</form>
				{:else if step === "invite"}
					<form class="flex flex-col gap-4" onsubmit={invite}>
						<Field>
							<FieldLabel for="emails">Email addresses</FieldLabel>
							<Textarea id="emails" rows={4} placeholder="ada@lab.edu, grace@lab.edu" bind:value={emails} />
							<FieldDescription>
								Separate with commas or new lines.
								{#if parsed.length}{parsed.length} valid address{parsed.length === 1 ? "" : "es"}.{/if}
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel>Role</FieldLabel>
							<ToggleGroup type="single" bind:value={role} variant="outline">
								<ToggleGroupItem value="member">Member</ToggleGroupItem>
								<ToggleGroupItem value="admin">Admin</ToggleGroupItem>
							</ToggleGroup>
						</Field>
						{#if error}<FieldError role="alert">{error}</FieldError>{/if}
						<div class="flex flex-wrap gap-2">
							<Button type="submit" variant="dark" disabled={busy || parsed.length === 0}>
								{#if busy}<IconLoader2 class="animate-spin" />{/if} Send invitations
							</Button>
							<Button type="button" variant="ghost" onclick={() => (step = "start")}>Skip for now</Button>
						</div>
					</form>
				{:else}
					<div class="flex flex-col gap-3">
						{#if org}
							<p class="text-muted-foreground flex items-center gap-2 text-sm">
								<IconCheck class="size-4" /> {org.name} is ready. New projects you create there belong to it.
							</p>
						{/if}
						<Button variant="dark" href="/workspace">Open my projects <IconArrowRight /></Button>
						<Button variant="outline" href="/workspace/templates">Browse templates</Button>
						{#if team}
							<p class="text-muted-foreground text-xs text-pretty">
								Connect single sign-on and SCIM later in Settings, Organization.
							</p>
						{/if}
					</div>
				{/if}
			</div>
		{/key}
	{/if}
</AuthShell>
