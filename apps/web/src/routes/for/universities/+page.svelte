<script lang="ts">
	import { resolve } from "$app/paths";
	import { track } from "$lib/analytics";
	import { CONTACT_EMAIL } from "$lib/landing/nav-data";
	import { breadcrumbLd, faqLd, serialise } from "$lib/seo/jsonld";
	import Seo from "$lib/seo/Seo.svelte";
	import { BrandPanel, FaqList, PageHero, RailFrame, RailRow, Section } from "$lib/site";
	import { Button } from "@glyphtex/ui/button";
	import { IconArrowRight, IconMail, IconSchool } from "@tabler/icons-svelte";

	const mailto = `${CONTACT_EMAIL}?subject=${encodeURIComponent("GlyphTeX for our university")}`;

	const controls = [
		{
			title: "Single sign-on",
			body: "Connect your identity provider over SAML or OpenID Connect, so people sign in with their campus account."
		},
		{
			title: "Automatic provisioning",
			body: "SCIM creates and removes accounts from your directory, so leavers lose access without a ticket."
		},
		{
			title: "Organisations and roles",
			body: "Group people by department or lab, with owner, admin and member roles and invitations by email."
		},
		{
			title: "Stronger sign-in",
			body: "Two-factor codes and passkeys are built in, with email verification and password reset."
		},
		{
			title: "Project sharing",
			body: "Owner, editor and viewer access, plus link sharing that you can switch off or let expire."
		},
		{
			title: "Review and history",
			body: "Comments, suggested edits, named versions with restore, and sync with GitHub, GitLab or Bitbucket."
		}
	];

	const hosting = [
		{
			title: "Your infrastructure",
			body: "Run the server on Cloudflare Workers or in Docker with Postgres. Projects and accounts stay in your region."
		},
		{
			title: "Optional by design",
			body: "The editor works with no server at all. Students can write offline and connect only to share."
		},
		{
			title: "Open source",
			body: "The editor is GPLv3 and the server is AGPL. Your IT team can read the code and audit what runs."
		},
		{
			title: "Health you can check",
			body: "The server reports its version, build and enabled features at a public status endpoint."
		}
	];

	const roadmap = [
		"Audit log export and retention controls",
		"A public status page and tested backup restore runbook",
		"An accessibility audit and a VPAT",
		"Classrooms, assignments and submissions"
	];

	const faqs = [
		{
			q: "Does student work leave the university?",
			a: "Not unless it is saved to a server. The browser editor keeps projects on the student's device. If you run the optional server, projects go only to your own infrastructure."
		},
		{
			q: "Can we deploy it ourselves?",
			a: "Yes. The self-hosting guide covers Cloudflare and Docker. The server is optional, so you can start with the editor alone and add it later."
		},
		{
			q: "What does it cost?",
			a: "The editor and server are free and open source today. There are no seats or licence keys. If you want help deploying or a support agreement, contact us."
		},
		{
			q: "Is it ready for a campus-wide rollout?",
			a: "We recommend a pilot with one department first. Single sign-on, provisioning and sharing work today. Audit export, an accessibility report and classroom features are still on the roadmap below."
		}
	];

	const jsonld = [
		serialise(
			breadcrumbLd([
				{ name: "Home", url: "/" },
				{ name: "For universities", url: "/for/universities" }
			])
		),
		...[faqLd(faqs)].filter((ld) => ld !== null).map((ld) => serialise(ld))
	];
</script>

<Seo
	title="GlyphTeX for universities: self-hosted LaTeX with SSO"
	description="An open source LaTeX editor for departments and labs. Student work stays on their device, with optional self-hosted sharing, SSO and SCIM provisioning."
	canonical="/for/universities"
	{jsonld}
/>

<RailFrame>
	<RailRow divider={false} label="For universities">
		<PageHero
			badge="for universities"
			title="LaTeX for a department,"
			accent="on your terms."
			lede="Students write on their own machines. When you want sharing, sign-in and review, run the optional server on your own infrastructure and connect it to your campus accounts."
		>
			{#snippet actions()}
				<Button
					href={mailto}
					size="lg"
					onclick={() => track('cta_clicked', { target: 'institution', location: 'universities_hero' })}
				>
					<IconMail />
					Talk to us about a pilot
				</Button>
				<Button href={resolve('/developers/self-hosting')} variant="outline" size="lg">
					Self-hosting guide
					<IconArrowRight />
				</Button>
			{/snippet}
		</PageHero>
	</RailRow>

	<Section
		id="controls"
		number={1}
		title="what admins get."
		description="Available on a server you run. None of it is needed by the editor itself."
		section="universities_controls"
	>
		<ul class="grid gap-x-10 sm:grid-cols-2">
			{#each controls as c (c.title)}
				<li class="border-t border-dashed border-border py-5">
					<h3 class="text-sm font-medium text-foreground">{c.title}</h3>
					<p class="mt-1 text-sm text-pretty text-muted-foreground">{c.body}</p>
				</li>
			{/each}
		</ul>
	</Section>

	<Section
		id="hosting"
		number={2}
		title="where the data lives."
		description="The answer a data protection officer asks for first."
		section="universities_hosting"
	>
		<ul class="grid gap-x-10 sm:grid-cols-2">
			{#each hosting as h (h.title)}
				<li class="border-t border-dashed border-border py-5">
					<h3 class="text-sm font-medium text-foreground">{h.title}</h3>
					<p class="mt-1 text-sm text-pretty text-muted-foreground">{h.body}</p>
				</li>
			{/each}
		</ul>
		<p class="mt-4 text-sm text-muted-foreground">
			What this website itself collects is on the
			<a href={resolve('/privacy')} class="text-primary underline underline-offset-4">privacy page</a>.
		</p>
	</Section>

	<Section
		id="roadmap"
		number={3}
		title="not built yet."
		description="Said plainly, so a pilot plans around it."
		section="universities_roadmap"
	>
		<ul class="flex flex-col">
			{#each roadmap as r (r)}
				<li class="border-t border-dashed border-border py-4 text-sm text-muted-foreground">{r}</li>
			{/each}
		</ul>
	</Section>

	<Section id="faq" number={4} title="questions." section="universities_faq">
		<FaqList items={faqs} />
	</Section>

	<RailRow label="Next step">
		<BrandPanel
			title="Start with one department."
			body="We will help you set up a pilot, and the editor is free to try today."
		>
			{#snippet icon()}
				<IconSchool aria-hidden="true" />
			{/snippet}
			{#snippet actions()}
				<Button
					href={mailto}
					variant="dark"
					onclick={() => track('cta_clicked', { target: 'institution', location: 'universities_final' })}
				>
					<IconMail />
					Contact us
				</Button>
				<Button href={resolve('/compare/overleaf')} variant="outline">GlyphTeX vs Overleaf</Button>
			{/snippet}
		</BrandPanel>
	</RailRow>
</RailFrame>
