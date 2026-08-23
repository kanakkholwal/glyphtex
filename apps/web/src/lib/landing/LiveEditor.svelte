<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { track, trackOnce } from "$lib/analytics";
	import { demoFiles, demoProjectFiles } from "$lib/landing/demo-files";
	import { Button } from "@glyphtex/ui/button";
	import type CodeEditor from "@glyphtex/ui/code-editor";
	import { settings } from "@glyphtex/ui/settings";
	import { IconArrowRight, IconBook, IconFileText, IconFolder } from "@tabler/icons-svelte";

	// The real CodeEditor, not a picture of one. CodeMirror is ~200 kB, so the
	// component is imported only once the panel scrolls into view, and a static
	// listing of the same source holds the box until it is live.

	type EditorApi = { ready: () => boolean };

	let Editor = $state<typeof CodeEditor>();
	let editorRef = $state<EditorApi>();
	let live = $state(false);
	let opening = $state(false);

	let activePath = $state(demoFiles[0].path);
	let edited = $state<Record<string, string>>({});

	const base = (path: string) => demoFiles.find((f) => f.path === path)?.text ?? "";
	const leaf = (path: string) => path.split("/").pop() ?? path;

	const active = $derived(demoFiles.find((f) => f.path === activePath) ?? demoFiles[0]);
	const source = $derived(edited[activePath] ?? active.text);
	const dirty = $derived(Object.entries(edited).some(([path, text]) => text !== base(path)));

	function whenVisible(node: HTMLElement) {
		if (typeof IntersectionObserver === "undefined") {
			void load();
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				io.disconnect();
				void load();
			},
			{ rootMargin: "200px" }
		);
		io.observe(node);
		return () => io.disconnect();
	}

	// CodeMirror is ~300 kB gzip. Waiting for idle keeps it off the main thread
	// until the hero has painted; the fallback covers Safari, which has no rIC.
	async function load(): Promise<void> {
		if (Editor) return;
		await new Promise<void>((done) =>
			typeof requestIdleCallback === "function"
				? requestIdleCallback(() => done(), { timeout: 2000 })
				: setTimeout(done, 400)
		);
		const mod = await import("@glyphtex/ui/code-editor");
		Editor = mod.default;
	}

	// The component resolving only means the shell mounted; CodeMirror lands a
	// beat later. Hold the static listing until there is a real view to show.
	$effect(() => {
		if (!editorRef || live) return;
		let frame = 0;
		const deadline = performance.now() + 4000;
		const poll = () => {
			if (editorRef?.ready()) {
				live = true;
				return;
			}
			if (performance.now() > deadline) return;
			frame = requestAnimationFrame(poll);
		};
		frame = requestAnimationFrame(poll);
		return () => cancelAnimationFrame(frame);
	});

	async function openInWorkspace(): Promise<void> {
		opening = true;
		try {
			const { createProject } = await import("$lib/storage/projects");
			const project = await createProject("Sample paper", demoProjectFiles(edited));
			track("document_created", { source: "template", location: "home_demo" });
			await goto(resolve(`/workspace/projects/${project.id}` as `/workspace/projects/${string}`));
		} catch (error) {
			console.error("[GlyphTeX]", error);
			opening = false;
			await goto(resolve("/workspace"));
		}
	}
</script>

<div {@attach whenVisible} class="flex h-[26rem] flex-col overflow-hidden text-left sm:h-[30rem]">
	<div class="flex min-h-0 flex-1">
		<!-- File list. Real switching: each file opens in the editor with its own
		     undo history, and edits survive moving between them. -->
		<div
			class="hidden w-52 shrink-0 flex-col gap-0.5 border-r border-hairline bg-surface-soft/60 p-2.5 sm:flex"
		>
			<div class="flex items-center gap-2 px-2 pt-1 pb-2.5 text-sm text-muted-foreground">
				<IconFolder class="size-4" stroke-width={1.75} />
				sample-paper
			</div>
			{#each demoFiles as file (file.path)}
				{@const Icon = file.path.endsWith('.bib') ? IconBook : IconFileText}
				<button
					type="button"
					onclick={() => {
						activePath = file.path;
						track('demo_file_opened', { file: leaf(file.path) });
					}}
					aria-current={activePath === file.path}
					class={[
						'flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-sm transition-colors',
						activePath === file.path
							? 'bg-surface-strong text-foreground'
							: 'text-muted-foreground hover:bg-surface-soft hover:text-foreground'
					]}
					style={file.path.includes('/') ? 'padding-left: 1.25rem' : undefined}
				>
					<Icon class="size-4 shrink-0" stroke-width={1.75} />
					<span class="truncate">{leaf(file.path)}</span>
				</button>
			{/each}
		</div>

		<div class="flex min-w-0 flex-1 flex-col">
			<div
				class="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5 text-sm"
			>
				<span class="truncate font-mono text-muted-foreground">{activePath}</span>
				<span class="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground">
					<span class="size-1.5 rounded-full {live ? 'bg-success' : 'bg-muted-foreground/50'}"
					></span>
					{live ? 'Live editor' : 'Loading editor'}
				</span>
			</div>

			<div class="relative min-h-0 flex-1">
				{#if Editor}
					<Editor
						bind:this={editorRef}
						bind:value={() => source,
						(next) => {
							edited[activePath] = next;
							trackOnce('demo_edited', 'demo_edited', { file: leaf(activePath) });
						}}
						docKey={activePath}
						language={active.language}
						theme={settings.resolved}
						fontSize={13}
						lineWrapping
						class="absolute inset-0"
					/>
				{/if}
				{#if !live}
					<pre
						aria-hidden="true"
						class="pointer-events-none absolute inset-0 overflow-hidden px-4 py-3 font-mono text-[13px] leading-[1.5] text-muted-foreground">{source}</pre>
				{/if}
			</div>
		</div>
	</div>

	<div
		class="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-3"
	>
		<p class="text-sm text-muted-foreground">
			{dirty ? 'Your edits come with you.' : 'This is the editor itself. Type in it.'}
		</p>
		<Button size="sm" disabled={opening} onclick={openInWorkspace}>
			{opening ? 'Opening…' : 'Open this in the workspace'}
			<IconArrowRight class="size-4" />
		</Button>
	</div>
</div>
