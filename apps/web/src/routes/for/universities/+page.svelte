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

	type Group = {
		id: string;
		title: string;
		accent: string;
		lede: string;
		items: { title: string; body: string }[];
	};

	const groups: Group[] = [
		{
			id: "identity",
			title: "Sign in with",
			accent: "campus accounts.",
			lede: "Connect your identity provider once per organization, and let your directory manage who has access.",
			items: [
				{
					title: "Single sign-on over SAML or OpenID Connect",
					body: "An organization owner or admin registers the identity provider in Settings. Members sign in with their campus account."
				},
				{
					title: "SCIM provisioning for users and groups",
					body: "Accounts are created and removed from your directory, so a leaver loses access without a ticket. Connections use expiring tokens that admins can rotate or remove."
				},
				{
					title: "Two-factor and passkeys",
					body: "Every account can use authenticator codes or passkeys, and an organization can require two-factor before members open its projects."
				},
				{
					title: "Invitations by email",
					body: "Invite people to an organization with a role, and cancel the invitation until it is accepted."
				}
			]
		},
		{
			id: "policy",
			title: "Set the rules",
			accent: "once, for everyone.",
			lede: "Admins control how work is shared inside the organization, without touching individual projects.",
			items: [
				{
					title: "Owner, admin and member roles",
					body: "Members create projects and read the organization. Admins also manage members, policy and the audit log. Owners can delete the organization."
				},
				{
					title: "Default access for new members",
					body: "Choose whether members start as editors, commenters or viewers, or with no access until they are added to a project."
				},
				{
					title: "Sharing controls",
					body: "Switch share links and invitations to people outside the organization on or off, and set a seat limit."
				},
				{
					title: "Per-member overrides",
					body: "Grant or withhold sharing, external invites or AI for one person. AI features are off by default."
				}
			]
		},
		{
			id: "oversight",
			title: "See what",
			accent: "changed.",
			lede: "Every administrative change leaves a record you can read and export.",
			items: [
				{
					title: "An audit log with CSV export",
					body: "Organization and policy changes, member and role changes, invitations, project sharing, and SSO and SCIM setup are all recorded. Admins can page through them or download a CSV."
				},
				{
					title: "Usage figures",
					body: "Members, projects, storage used, members active in the last 30 days and projects edited this week, shown to admins in Settings."
				}
			]
		},
		{
			id: "content",
			title: "Share what",
			accent: "your department owns.",
			lede: "Organization projects stay with the organization, not with whoever created them.",
			items: [
				{
					title: "Organization templates",
					body: "Save a thesis, lab report or exam template that members start from."
				},
				{
					title: "A shared package library",
					body: "Publish the packages and class files your department uses, so every member compiles the same document."
				},
				{
					title: "Projects outlive people",
					body: "When a creator leaves, ownership of their organization projects moves to an owner or admin instead of disappearing."
				}
			]
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
			body: "The server reports its version, build and enabled features at a public status endpoint, and the repository ships an uptime check."
		}
	];

	const roadmap = [
		"Classrooms, assignments and submissions",
		"Per-organization data retention windows",
		"An accessibility audit and a VPAT",
		"A public status page"
	];

	const faqs = [
		{
			q: "Does student work leave the university?",
			a: "Not unless it is saved to a server. The browser editor keeps projects on the student's device. If you run the optional server, projects go only to your own infrastructure."
		},
		{
			q: "Which identity providers work?",
			a: "Single sign-on is configured per organization and supports SAML and OpenID Connect providers, so Microsoft Entra ID, Google Workspace and most campus identity systems fit. SCIM provisioning needs a directory that can push to a SCIM endpoint."
		},
		{
			q: "Who can change the settings?",
			a: "Organization owners and admins. Members can create projects and read the organization, but cannot change policy, SSO or SCIM, and cannot read the audit log."
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
			a: "We recommend a pilot with one department first. Single sign-on, provisioning, policy and the audit log work today. Classrooms, an accessibility report and retention windows are on the roadmap below."
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
	title="GlyphTeX for universities: SSO, SCIM and an audit log, self-hosted"
	description="An open source LaTeX editor for departments and labs. SAML and OIDC single sign-on, SCIM provisioning, roles, sharing policy and an exportable audit log, on your own infrastructure."
	canonical="/for/universities"
	{jsonld}
/>

<RailFrame>
	<RailRow divider={false} label="For universities">
		<PageHero
			title="LaTeX for a department,"
			accent="on your terms."
			lede="Students write on their own machines. When you want sharing and review, run the optional server on your own infrastructure with single sign-on, SCIM provisioning, sharing policy and an audit log."
		>
			{#snippet actions()}
				<Button
					href={mailto}
					variant="dark"
					size="lg"
					onclick={() => track('cta_clicked', { target: 'institution', location: 'universities_hero' })}
				>
					<IconMail />
					Talk to us about a pilot
				</Button>
				<Button
					href={`${resolve('/workspace/sign-in')}?mode=signup&intent=team`}
					variant="outline"
					size="lg"
					onclick={() => track('cta_clicked', { target: 'team_signup', location: 'universities_hero' })}
				>
					Create a team workspace
				</Button>
				<Button href={resolve('/developers/self-hosting')} variant="outline" size="lg">
					Self-hosting guide
					<IconArrowRight />
				</Button>
			{/snippet}
		</PageHero>
	</RailRow>

	{#each groups as g (g.id)}
		<Section
			id={g.id}
			title={g.title}
			accent={g.accent}
			description={g.lede}
			section={`universities_${g.id}`}
		>
			<dl class="grid gap-x-10 gap-y-8 sm:grid-cols-2">
				{#each g.items as item (item.title)}
					<div class="border-t border-border pt-5">
						<dt class="text-base font-medium text-foreground">{item.title}</dt>
						<dd class="mt-2 text-sm text-pretty text-muted-foreground">{item.body}</dd>
					</div>
				{/each}
			</dl>
		</Section>
	{/each}

	<Section
		id="hosting"
		title="Where the data"
		accent="lives."
		description="The answer a data protection officer asks for first."
		section="universities_hosting"
	>
		<dl class="grid gap-x-10 gap-y-8 sm:grid-cols-2">
			{#each hosting as h (h.title)}
				<div class="border-t border-border pt-5">
					<dt class="text-base font-medium text-foreground">{h.title}</dt>
					<dd class="mt-2 text-sm text-pretty text-muted-foreground">{h.body}</dd>
				</div>
			{/each}
		</dl>
		<p class="mt-8 text-sm text-muted-foreground">
			What this website itself collects is on the
			<a href={resolve('/privacy')} class="text-primary underline underline-offset-4">privacy page</a>.
		</p>
	</Section>

	<Section
		id="roadmap"
		title="Not built"
		accent="yet."
		description="Said plainly, so a pilot plans around it."
		section="universities_roadmap"
	>
		<ul class="flex flex-col">
			{#each roadmap as r (r)}
				<li class="border-t border-border py-4 text-base text-muted-foreground">{r}</li>
			{/each}
		</ul>
	</Section>

	<Section id="faq" title="Questions" accent="from IT and faculty." section="universities_faq">
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
