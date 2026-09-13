<script lang="ts">
	import { analyticsConfigured, hasOptedOut, setOptedOut } from "$lib/analytics";
	import { CONTACT_EMAIL, REPO_URL } from "$lib/landing/nav-data";
	import Seo from "$lib/seo/Seo.svelte";
	import { PageHero, RailFrame, RailRow } from "$lib/site";
	import { Switch } from "@glyphtex/ui/switch";
	import { onMount } from "svelte";

	const updated = "13 September 2026";

	// Mirrors the closed union in `$lib/analytics/types.ts`; an event added there needs a row here.
	const events: { name: string; when: string; data: string }[] = [
		{
			name: "page_view",
			when: "You open or navigate to a page on this site.",
			data: "Path, page title, referrer."
		},
		{
			name: "section_viewed",
			when: "A section of a page on this site scrolls into view.",
			data: "Which section."
		},
		{
			name: "cta_clicked / outbound_clicked / download_clicked",
			when: "You click a call-to-action, a link off the site, or a download link.",
			data: "Which button and where it sits; for downloads, the platform and release version."
		},
		{
			name: "faq_expanded",
			when: "You open an FAQ answer.",
			data: "The position of the question in the list."
		},
		{
			name: "demo_file_opened / demo_edited",
			when: "You switch files or type in the demo editor on the home page.",
			data: "Which of the sample file names. Never what you typed."
		},
		{
			name: "document_created / document_import_failed",
			when: "You create, import, or clone a document, or an import produces nothing.",
			data: "Where it came from (blank, template, zip, folder, Git clone), a file-count bucket, and for a failure whether it was empty, all-ignored, or an error."
		},
		{
			name: "document_opened / document_exported / files_added",
			when: "You open a document, export it, or add files to an open one.",
			data: "A file-count bucket, and what kind of export (project zip, single file, folder zip)."
		},
		{
			name: "document_renamed / document_duplicated / document_deleted / document_starred",
			when: "You perform that action on a document.",
			data: "Nothing beyond the fact that it happened."
		},
		{
			name: "file_created / file_renamed / file_moved / file_duplicated / file_deleted / main_file_set / main_file_chosen",
			when: "You add, rename, move, duplicate, or delete a file or folder inside a document, or pick its main file.",
			data: "Whether it was a file or a folder and its broad type (latex, image, pdf...). Never the name."
		},
		{
			name: "editor_mode_changed / view_changed / panel_view_changed / panel_toggled / dock_tab_changed / split_direction_changed / command_palette_opened / diff_opened",
			when: "You change the editor's layout: source vs visual, the preview split, a side or bottom panel, the command palette, a diff.",
			data: "Which surface, and whether it opened or closed."
		},
		{
			name: "format_applied / note_added",
			when: "You apply bold or italic, or add a note to a document.",
			data: "Which mark and which editing surface; for a note, how many tags it carries. Never the text."
		},
		{
			name: "project_search_run / project_replace_all",
			when: "A project-wide search settles, or you replace every match.",
			data: "How many files were scanned, how many matches were found or replaced, and whether it was a regex. Never the query."
		},
		{
			name: "compile_started / compile_finished",
			when: "A compile starts and finishes.",
			data: "Whether it was manual or automatic, whether a PDF was produced, how long it took, a file-count bucket, and the number of diagnostics and missing package sets."
		},
		{
			name: "pdf_downloaded",
			when: "You save the compiled PDF.",
			data: "The page count."
		},
		{
			name: "engine_install_prompted / engine_installed / engine_packs_installed",
			when: "The one-time LaTeX engine download is offered or finishes, or missing packages are fetched.",
			data: "How many package sets, and whether it succeeded."
		},
		{
			name: "app_update_applied",
			when: "You apply a pending update to the editor.",
			data: "Nothing beyond the fact that it happened."
		},
		{
			name: "git_action",
			when: "You initialise, commit, push, pull, or clone in source control.",
			data: "Which of those actions, and whether a pull hit conflicts."
		}
	];

	const never = [
		"The contents of any document, ever. Nothing you type is transmitted.",
		"Document names, file names, folder names, or the text of any compile error.",
		"Git remote URLs, repository names, branch names, or commit messages.",
		"Access tokens or any other credential.",
		"Your files, which stay in your browser's local storage on your own device."
	];

	const toc = [
		{ id: "short", label: "The short version" },
		{ id: "storage", label: "What the editor stores" },
		{ id: "collected", label: "What the website collects" },
		{ id: "never", label: "What is never collected" },
		{ id: "desktop", label: "The desktop app" },
		{ id: "verify", label: "Verifying this" },
		{ id: "contact", label: "Contact" }
	];

	// Null until mounted: the choice lives in this browser's storage, which SSR cannot read.
	let configured = $state<boolean | null>(null);
	let allowed = $state(true);

	onMount(() => {
		configured = analyticsConfigured();
		allowed = !hasOptedOut();
	});

	const link =
		"rounded-sm font-medium text-primary underline underline-offset-4 outline-none hover:decoration-2 focus-visible:ring-2 focus-visible:ring-ring";
	const h2 = "scroll-mt-28 font-heading text-subheading font-medium text-foreground";
</script>

<Seo
	title="Privacy · GlyphTeX"
	description="What GlyphTeX collects on this website, and what it never collects."
	canonical="/privacy"
/>

<RailFrame>
	<RailRow divider={false} label="Privacy">
		<PageHero
			badge="Updated {updated}"
			title="Your documents"
			accent="stay on your device"
			lede="What this website collects, what the editor stores, and what is never sent anywhere."
		/>
	</RailRow>

	<RailRow label="Privacy policy">
		<div
			class="grid grid-cols-1 gap-10 px-1 py-6 sm:px-4 sm:py-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-16 lg:px-16 lg:py-10"
		>
			<div class="flex max-w-3xl min-w-0 flex-col gap-10 text-body-lg text-muted-foreground">
				<section class="flex flex-col gap-4" aria-labelledby="short">
					<h2 id="short" class={h2}>The short version</h2>
					<p>
						Your documents stay on your device unless you push them to a Git host yourself. They are stored by your browser, on your
						computer, and are never uploaded to us or anyone else. There is no account, no server
						that holds your work, and no way for us to read it.
					</p>
					<p>
						This <em>website</em> does use analytics, so we can see which pages are read and roughly
						how the editor is used. That is separate from your documents, and
						<a href="#analytics-choice" class={link}>you can switch it off</a>.
					</p>
				</section>

				<section class="flex flex-col gap-4" aria-labelledby="storage">
					<h2 id="storage" class={h2}>What the editor stores, and where</h2>
					<p>
						Documents, their files, and your settings live in your browser's IndexedDB and local
						storage. The LaTeX engine is downloaded once and cached the same way. Clearing your
						browser's site data for this domain deletes all of it permanently: we hold no copy, so
						there is nothing for us to restore. Export a zip if you need a backup.
					</p>
					<p>
						When you push or pull in source control, the request goes to the Git host you
						configured and, because browsers cannot reach Git servers directly, through a relay
						proxy. That relay sees the request and any access token in it. The relay address is
						yours to change or to blank out in the source control settings. We do not operate it,
						and we do not receive that traffic.
					</p>
				</section>

				<section class="flex flex-col gap-4" aria-labelledby="collected">
					<h2 id="collected" class={h2}>What the website collects</h2>
					<p>
						Analytics are currently provided by Google Analytics 4. Google sets cookies and
						receives your IP address, approximate location, device, browser, and the events listed
						below. See
						<a
							href="https://policies.google.com/privacy"
							rel="noreferrer noopener"
							target="_blank"
							class={link}>Google's privacy policy</a
						>. We may replace this provider later; this page will say so when we do.
					</p>

					<div id="analytics-choice" class="panel-card scroll-mt-28 p-5">
						{#if configured === false}
							<p class="text-body text-muted-foreground">
								Analytics are not configured on this deployment, so nothing is sent from this site.
							</p>
						{:else}
							<label class="flex min-h-11 cursor-pointer items-center justify-between gap-4">
								<span class="flex flex-col">
									<span class="text-body-lg font-medium text-foreground">Analytics in this browser</span>
									<span class="text-body text-muted-foreground" aria-live="polite">
										{allowed ? "On: events below are sent." : "Off: nothing is sent from this browser."}
									</span>
								</span>
								<Switch
									checked={allowed}
									disabled={configured === null}
									onCheckedChange={(value) => {
										allowed = value;
										setOptedOut(!value);
									}}
								/>
							</label>
							<p class="mt-3 text-caption text-muted-foreground">
								Saved in this browser only. If site storage is blocked, analytics stay off.
							</p>
						{/if}
					</div>

					<h3 class="pt-2 font-heading text-body-lg font-semibold text-foreground">Events</h3>
					<div class="panel-card overflow-x-auto">
						<table class="w-full min-w-136 border-collapse text-left text-body">
							<thead class="bg-muted">
								<tr>
									<th scope="col" class="px-4 py-3 font-medium text-foreground">Event</th>
									<th scope="col" class="px-4 py-3 font-medium text-foreground">Sent when</th>
									<th scope="col" class="px-4 py-3 font-medium text-foreground">What it carries</th>
								</tr>
							</thead>
							<tbody>
								{#each events as e (e.name)}
									<tr class="border-t border-border align-top">
										<td class="px-4 py-3 font-mono text-caption wrap-break-word text-foreground">{e.name}</td>
										<td class="px-4 py-3 text-muted-foreground">{e.when}</td>
										<td class="px-4 py-3 text-muted-foreground">{e.data}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<p class="text-body text-muted-foreground">
						File counts are reported as buckets (1, 2-5, 6-20, 21-100, 100+) rather than exact
						numbers, so a document's shape cannot be inferred from them.
					</p>
				</section>

				<section class="flex flex-col gap-4" aria-labelledby="never">
					<h2 id="never" class={h2}>What is never collected</h2>
					<ul class="flex list-disc flex-col gap-2 pl-5 marker:text-primary">
						{#each never as item (item)}
							<li class="pl-1">{item}</li>
						{/each}
					</ul>
				</section>

				<section class="flex flex-col gap-4" aria-labelledby="desktop">
					<h2 id="desktop" class={h2}>The desktop app</h2>
					<p>
						The desktop build contains no analytics of any kind. It makes no network request unless
						you ask it to: downloading the engine, or talking to a Git remote you configured.
					</p>
				</section>

				<section class="flex flex-col gap-4" aria-labelledby="verify">
					<h2 id="verify" class={h2}>Verifying this</h2>
					<p>
						GlyphTeX is GPLv3 and the whole client is open source. Everything described here is in
						<code class="rounded-sm bg-muted px-1 font-mono text-body text-foreground"
							>apps/web/src/lib/analytics/</code
						>, and the event list above mirrors the typed union in
						<code class="rounded-sm bg-muted px-1 font-mono text-body text-foreground">types.ts</code
						>. The editor reports its own events through
						<code class="rounded-sm bg-muted px-1 font-mono text-body text-foreground"
							>packages/ui/src/lib/state/telemetry.ts</code
						>, which does nothing at all unless this website installs a sink: that is why the
						desktop build sends none. If this page and the code ever disagree,
						<a href="{REPO_URL}/issues" rel="noreferrer noopener" target="_blank" class={link}
							>open an issue</a
						>: the code is the thing to trust.
					</p>
				</section>

				<section class="flex flex-col gap-4" aria-labelledby="contact">
					<h2 id="contact" class={h2}>Contact</h2>
					<p>
						Questions, or a request to delete something:
						<a href={CONTACT_EMAIL} class={link}>get in touch</a>. We hold no personal data of yours
						beyond what Google Analytics collects, and no account to attach it to.
					</p>
				</section>
			</div>

			<aside class="hidden lg:block">
				<nav aria-label="On this page" class="sticky top-28 flex flex-col">
					<p class="pb-2 text-caption font-medium text-muted-foreground">On this page</p>
					{#each toc as item (item.id)}
						<a
							href="#{item.id}"
							class="flex min-h-10 items-center rounded-md px-2 text-body text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
						>
							{item.label}
						</a>
					{/each}
				</nav>
			</aside>
		</div>
	</RailRow>
</RailFrame>
