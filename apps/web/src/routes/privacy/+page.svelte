<script lang="ts">
	import { Container, Section } from "$lib/landing";
	import { CONTACT_EMAIL, REPO_URL } from "$lib/landing/nav-data";
	import Seo from "$lib/seo/Seo.svelte";
	import SiteFooter from "$lib/SiteFooter.svelte";
	import SiteHeader from "$lib/SiteHeader.svelte";

	const updated = "23 July 2026";

	// Mirrors the closed union in `$lib/analytics/types.ts`. If an event is added
	// there without a row here, this page is out of date.
	const events: { name: string; when: string; data: string }[] = [
		{
			name: "page_view",
			when: "You open or navigate to a page on this site.",
			data: "Path, page title, referrer."
		},
		{
			name: "section_viewed",
			when: "A section of the home page scrolls into view.",
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
			data: "Which of the three sample file names. Never what you typed."
		},
		{
			name: "document_created / document_import_failed",
			when: "You create, import, or clone a document, or an import produces nothing.",
			data: "Where it came from (blank, zip, folder, Git clone), a file-count bucket, and for a failure whether it was empty, all-ignored, or an error."
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
			data: "Whether it was a file or a folder and its broad type (latex, image, pdf…). Never the name."
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
		"Your files, which stay in your browser’s local storage on your own device."
	];
</script>

<Seo
	title="Privacy · GlyphTeX"
	description="What GlyphTeX collects on this website, and what it never collects."
	canonical="/privacy"
/>

<SiteHeader />

<main>
	<Section spacing="tight">
		<Container>
			<div class="mx-auto max-w-2xl py-10">
				<h1 class="text-3xl font-semibold tracking-tight">Privacy</h1>
				<p class="text-muted-foreground mt-2 text-sm">Last updated {updated}</p>

				<div class="prose prose-sm dark:prose-invert mt-8 max-w-none">
					<h2>The short version</h2>
					<p>
						Your documents never leave your device. They are stored by your browser, on your
						computer, and are never uploaded to us or anyone else. There is no account, no server
						that holds your work, and no way for us to read it.
					</p>
					<p>
						This <em>website</em> does use analytics, so we can see which pages are read and roughly how
						the editor is used. That is separate from your documents, and you can switch it off below.
					</p>

					<h2>What the editor stores, and where</h2>
					<p>
						Documents, their files, and your settings live in your browser’s IndexedDB and local
						storage. The LaTeX engine is downloaded once and cached the same way. Clearing your
						browser’s site data for this domain deletes all of it permanently: we hold no copy, so
						there is nothing for us to restore. Export a zip if you need a backup.
					</p>
					<p>
						When you push or pull in source control, the request goes to the Git host you configured
						and, because browsers cannot reach Git servers directly, through a relay proxy. That
						relay sees the request and any access token in it. The relay address is yours to change
						or to blank out in the source control settings. We do not operate it, and we do not
						receive that traffic.
					</p>

					<h2>What the website collects</h2>
					<p>
						Analytics are currently provided by Google Analytics 4. Google sets cookies and receives
						your IP address, approximate location, device, browser, and the events listed below. See
						<a href="https://policies.google.com/privacy" rel="noreferrer noopener" target="_blank"
							>Google’s privacy policy</a
						>. We may replace this provider later; this page will say so when we do.
					</p>

					<h3>Events</h3>
				</div>

				<div class="border-border mt-4 overflow-x-auto rounded-lg border">
					<table class="w-full min-w-[34rem] border-collapse text-left text-sm">
						<thead class="bg-muted/40">
							<tr>
								<th class="px-3 py-2 font-medium">Event</th>
								<th class="px-3 py-2 font-medium">Sent when</th>
								<th class="px-3 py-2 font-medium">What it carries</th>
							</tr>
						</thead>
						<tbody>
							{#each events as e (e.name)}
								<tr class="border-border/60 border-t align-top">
									<td class="text-foreground/90 px-3 py-2 font-mono text-xs">{e.name}</td>
									<td class="text-muted-foreground px-3 py-2">{e.when}</td>
									<td class="text-muted-foreground px-3 py-2">{e.data}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="prose prose-sm dark:prose-invert mt-8 max-w-none">
					<p class="text-muted-foreground text-xs">
						File counts are reported as buckets (1, 2-5, 6-20, 21-100, 100+) rather than exact
						numbers, so a document’s shape cannot be inferred from them.
					</p>

					<h2>What is never collected</h2>
					<ul>
						{#each never as item (item)}
							<li>{item}</li>
						{/each}
					</ul>

					<h2>The desktop app</h2>
					<p>
						The desktop build contains no analytics of any kind. It makes no network request unless
						you ask it to: downloading the engine, or talking to a Git remote you configured.
					</p>

					<h2>Verifying this</h2>
					<p>
						GlyphTeX is GPLv3 and the whole client is open source. Everything described here is in
						<code>apps/web/src/lib/analytics/</code>, and the event list above mirrors the typed
						union in <code>types.ts</code>. The editor reports its own events through
						<code>packages/ui/src/lib/state/telemetry.ts</code>, which does nothing at all unless
						this website installs a sink: that is why the desktop build sends none. If this page and
						the code ever disagree,
						<a href={`${REPO_URL}/issues`} rel="noreferrer noopener" target="_blank"
							>open an issue</a
						>: the code is the thing to trust.
					</p>

					<h2>Contact</h2>
					<p>
						Questions, or a request to delete something: <a href={CONTACT_EMAIL}>get in touch</a>.
						Note that we hold no personal data of yours beyond what Google Analytics collects, and
						no account to attach it to.
					</p>
				</div>
			</div>
		</Container>
	</Section>
</main>

<SiteFooter />
