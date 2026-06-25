<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { IconChevronUp, IconChevronDown, IconX } from '@tabler/icons-svelte';
	import { SEARCH_BTN, SEARCH_COUNT, SEARCH_INPUT, searchPill } from './search-ui';
	// PDF.js layer styles (canvas/text/annotation positioning + selection). This is
	// the *component* stylesheet only — NOT the full pdf.js viewer app, so there is
	// no browser PDF toolbar/chrome. We re-theme the bits we care about below.
	import 'pdfjs-dist/web/pdf_viewer.css';

	/**
	 * PdfView — headless PDF preview built on PDF.js' `PDFViewer` component
	 * (`pdfjs-dist/web/pdf_viewer.mjs`), the same engine Overleaf uses. It renders,
	 * per page, a canvas + a transparent **text layer** (selectable/searchable) +
	 * an **annotation layer** (clickable links), all pixel-aligned and virtualized
	 * (only visible pages paint). No toolbar — every control here is ours.
	 *
	 * pdfjs is imported lazily in onMount so it never runs during SSR/prerender.
	 */
	let {
		data,
		onreverse,
		scalePct = $bindable(100),
		fitMode = $bindable(true),
		numPages = $bindable(0)
	}: {
		data?: Uint8Array;
		onreverse?: (loc: { page: number; x: number; y: number }) => void;
		/** Current zoom (%) — bindable so the host toolbar can display it. */
		scalePct?: number;
		/** True while fit-to-width is active. */
		fitMode?: boolean;
		/** Page count of the rendered document. */
		numPages?: number;
	} = $props();

	// pdf.js' viewer entry points (`pdfjs-dist/web/pdf_viewer.mjs`) ship no
	// first-class types at this import path, so the dynamically-imported module
	// and engine handles are an untyped external boundary (AGENTS.md rule #7 —
	// justified scoped exception). Event payloads *are* narrowed where consumed.
	/* eslint-disable @typescript-eslint/no-explicit-any */
	let pdfjs: any = null;
	let viewerMod: any = null;
	let pdfViewer: any = null;
	let eventBus: any = null;
	let linkService: any = null;
	let findController: any = null;
	let doc: any = null;
	let loadToken = 0;
	let resizeObserver: ResizeObserver | undefined;
	let flashEl: HTMLDivElement | null = null;
	let flashTimer: ReturnType<typeof setTimeout> | undefined;
	let restoreRatio: number | null = null;

	let containerEl = $state<HTMLDivElement>();
	let viewerEl = $state<HTMLDivElement>();

	let ready = $state(false); // engine constructed
	let hasRendered = $state(false); // first document painted
	let loading = $state(false);
	let errorMsg = $state<string | undefined>(undefined);

	// Find-in-PDF state
	let findOpen = $state(false);
	let findQuery = $state('');
	let findCaseSensitive = $state(false);
	let findCurrent = $state(0);
	let findTotal = $state(0);
	let findInputEl = $state<HTMLInputElement>();

	onMount(async () => {
		pdfjs = await import('pdfjs-dist');
		viewerMod = await import('pdfjs-dist/web/pdf_viewer.mjs');
		const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
		pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

		if (!containerEl || !viewerEl) return;

		eventBus = new viewerMod.EventBus();
		linkService = new viewerMod.PDFLinkService({
			eventBus,
			externalLinkTarget: viewerMod.LinkTarget.BLANK,
			externalLinkRel: 'noopener'
		});
		findController = new viewerMod.PDFFindController({ eventBus, linkService });
		pdfViewer = new viewerMod.PDFViewer({
			container: containerEl,
			viewer: viewerEl,
			eventBus,
			linkService,
			findController,
			annotationMode: pdfjs.AnnotationMode.ENABLE, // clickable links
			annotationEditorMode: pdfjs.AnnotationEditorType.DISABLE,
			removePageBorders: true, // we draw page chrome ourselves
			maxCanvasPixels: 8192 * 8192
		});
		linkService.setViewer(pdfViewer);

		eventBus.on('pagesinit', () => {
			pdfViewer.currentScaleValue = fitMode ? 'page-width' : pdfViewer.currentScale;
			// Restore scroll position across recompiles (don't jump to top).
			if (restoreRatio != null && containerEl) {
				const max = containerEl.scrollHeight - containerEl.clientHeight;
				containerEl.scrollTop = Math.max(0, restoreRatio * max);
				restoreRatio = null;
			}
			numPages = pdfViewer.pagesCount ?? 0;
			hasRendered = true;
			loading = false;
		});
		eventBus.on('scalechanging', (e: { scale?: number }) => {
			if (typeof e?.scale === 'number') scalePct = Math.round(e.scale * 100);
		});
		const onMatches = (e: { matchesCount?: { current?: number; total?: number } }) => {
			findCurrent = e?.matchesCount?.current ?? 0;
			findTotal = e?.matchesCount?.total ?? 0;
		};
		eventBus.on('updatefindmatchescount', onMatches);
		eventBus.on('updatefindcontrolstate', onMatches);

		// Refit on container resize while in a fit mode.
		resizeObserver = new ResizeObserver(() => {
			if (pdfViewer && fitMode) pdfViewer.currentScaleValue = 'page-width';
		});
		resizeObserver.observe(containerEl);

		ready = true;
		await loadDoc();
	});

	onDestroy(() => {
		loadToken++;
		resizeObserver?.disconnect();
		clearTimeout(flashTimer);
		try {
			pdfViewer?.setDocument(null);
			linkService?.setDocument(null);
		} catch {
			/* ignore */
		}
		if (doc) {
			try {
				doc.destroy();
			} catch {
				/* ignore */
			}
		}
	});

	// Reload when the PDF bytes change.
	$effect(() => {
		void data;
		if (ready) loadDoc();
	});

	async function loadDoc() {
		if (!pdfjs || !pdfViewer) return;
		const token = ++loadToken;
		errorMsg = undefined;

		if (!data || data.length === 0) {
			try {
				pdfViewer.setDocument(null);
				linkService.setDocument(null);
			} catch {
				/* ignore */
			}
			if (doc) {
				try {
					doc.destroy();
				} catch {
					/* ignore */
				}
				doc = null;
			}
			hasRendered = false;
			return;
		}

		// Preserve scroll position for the upcoming document (live recompiles).
		if (containerEl && hasRendered) {
			const max = containerEl.scrollHeight - containerEl.clientHeight;
			restoreRatio = max > 0 ? containerEl.scrollTop / max : 0;
		}

		if (!hasRendered) loading = true;
		try {
			const bytes = data.slice(); // pdfjs detaches the buffer
			const task = pdfjs.getDocument({ data: bytes });
			const next = await task.promise;
			if (token !== loadToken) {
				next.destroy();
				return;
			}
			const prev = doc;
			doc = next;
			pdfViewer.setDocument(doc);
			linkService.setDocument(doc, null);
			findController?.setDocument(doc);
			if (findOpen && findQuery) runFind(); // re-apply find across recompiles
			if (prev) {
				try {
					prev.destroy();
				} catch {
					/* ignore */
				}
			}
		} catch (e) {
			if (token === loadToken) {
				errorMsg = String(e);
				loading = false;
			}
		}
	}

	function onDblClick(e: MouseEvent) {
		if (!onreverse || !pdfViewer) return;
		const pageEl = (e.target as HTMLElement).closest<HTMLElement>('.page');
		if (!pageEl) return;
		const pageNumber = parseInt(pageEl.dataset.pageNumber ?? '', 10);
		const pageView = pdfViewer.getPageView(pageNumber - 1);
		const viewport = pageView?.viewport;
		if (!viewport) return;

		const canvas = pageEl.querySelector('canvas') ?? pageEl;
		const rect = canvas.getBoundingClientRect();
		const vx = ((e.clientX - rect.left) / rect.width) * viewport.width;
		const vy = ((e.clientY - rect.top) / rect.height) * viewport.height;
		const [pdfX, pdfY] = viewport.convertToPdfPoint(vx, vy);
		const heightPt = viewport.viewBox[3] - viewport.viewBox[1];
		onreverse({ page: pageNumber, x: pdfX, y: heightPt - pdfY });
	}

	/**
	 * Forward sync: scroll to a PDF region (big-points, `v` from top) and flash a
	 * highlight over it.
	 */
	export function revealLocation(loc: {
		page: number;
		h: number;
		v: number;
		width: number;
		height: number;
		depth: number;
	}) {
		if (!pdfViewer || !containerEl) return;
		const pageView = pdfViewer.getPageView(loc.page - 1);
		const viewport = pageView?.viewport;
		const pageDiv: HTMLElement | undefined = pageView?.div;
		if (!viewport || !pageDiv) {
			pdfViewer.currentPageNumber = loc.page;
			return;
		}
		const s = viewport.scale;
		const topPx = Math.max(0, (loc.v - loc.height) * s);
		const hPx = Math.max(12, (loc.height + loc.depth) * s);
		const leftPx = Math.max(0, loc.h * s);
		const wPx = loc.width > 0 ? loc.width * s : Math.max(24, pageDiv.clientWidth - leftPx);

		if (flashEl) flashEl.remove();
		const el = document.createElement('div');
		el.className = 'glyphx-sync-flash';
		el.style.left = `${leftPx}px`;
		el.style.top = `${topPx}px`;
		el.style.width = `${wPx}px`;
		el.style.height = `${hPx}px`;
		pageDiv.appendChild(el);
		flashEl = el;
		clearTimeout(flashTimer);
		flashTimer = setTimeout(() => {
			el.remove();
			if (flashEl === el) flashEl = null;
		}, 1500);

		containerEl.scrollTo({ top: Math.max(0, pageDiv.offsetTop + topPx - 100), behavior: 'smooth' });
	}

	function fit() {
		fitMode = true;
		if (pdfViewer) pdfViewer.currentScaleValue = 'page-width';
	}
	function zoomTo(scale: number) {
		if (!pdfViewer) return;
		fitMode = false;
		pdfViewer.currentScale = Math.min(4, Math.max(0.25, +scale.toFixed(2)));
	}

	// Imperative zoom API for the host preview toolbar.
	export function zoomIn() {
		zoomTo((pdfViewer?.currentScale ?? 1) + 0.1);
	}
	export function zoomOut() {
		zoomTo((pdfViewer?.currentScale ?? 1) - 0.1);
	}
	export function setZoomPct(pct: number) {
		zoomTo(pct / 100);
	}
	export function fitWidth() {
		fit();
	}
	function onWheel(e: WheelEvent) {
		if (!(e.ctrlKey || e.metaKey) || !pdfViewer) return;
		e.preventDefault();
		zoomTo(pdfViewer.currentScale - e.deltaY * 0.002);
	}

	// --- Find in PDF (PDFFindController) --------------------------------------
	function runFind(again = false, findPrevious = false) {
		eventBus?.dispatch('find', {
			source: null,
			type: again ? 'again' : '',
			query: findQuery,
			caseSensitive: findCaseSensitive,
			entireWord: false,
			highlightAll: true,
			findPrevious,
			matchDiacritics: false
		});
	}
	function findNext() {
		if (findQuery) runFind(true, false);
	}
	function findPrev() {
		if (findQuery) runFind(true, true);
	}
	function onFindInput() {
		if (findQuery) runFind(false, false);
		else {
			findCurrent = 0;
			findTotal = 0;
			eventBus?.dispatch('findbarclose', { source: null });
		}
	}
	function onFindKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			e.shiftKey ? findPrev() : findNext();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			closeFind();
		}
	}
	/** Open the find bar (called from the host preview toolbar). */
	export function openFind() {
		findOpen = true;
		queueMicrotask(() => findInputEl?.select());
	}
	function closeFind() {
		findOpen = false;
		eventBus?.dispatch('findbarclose', { source: null });
		containerEl?.focus?.();
	}
	function onContainerKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
			e.preventDefault();
			e.stopPropagation();
			openFind();
		}
	}
</script>

<div class="relative flex h-full min-h-0 flex-col">
	<div class="relative min-h-0 flex-1">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={containerEl}
			class="glyphx-pdf-container absolute inset-0 overflow-auto"
			tabindex="-1"
			ondblclick={onDblClick}
			onwheel={onWheel}
			onkeydown={onContainerKeydown}
		>
			<div bind:this={viewerEl} class="pdfViewer"></div>
		</div>

		{#if findOpen}
			<div
				class="border-border bg-card shadow-craft-lg absolute top-3 right-3 z-20 flex items-center gap-1 rounded-lg border p-1.5"
				role="search"
			>
				<!-- Find field with the Aa toggle inside it (matches the editor find bar). -->
				<div class="relative">
					<input
						bind:this={findInputEl}
						bind:value={findQuery}
						oninput={onFindInput}
						onkeydown={onFindKeydown}
						class="{SEARCH_INPUT} w-44 pr-7"
						placeholder="Find in PDF"
						aria-label="Find in PDF"
						spellcheck="false"
					/>
					<div class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
						<button
							class={searchPill(findCaseSensitive)}
							title="Match case"
							aria-label="Match case"
							aria-pressed={findCaseSensitive}
							onclick={() => {
								findCaseSensitive = !findCaseSensitive;
								onFindInput();
							}}
						>
							Aa
						</button>
					</div>
				</div>
				<span class="{SEARCH_COUNT} w-16 text-center">
					{#if findQuery && findTotal}
						{findCurrent} of {findTotal}
					{:else if findQuery}
						No results
					{/if}
				</span>
				<button
					class={SEARCH_BTN}
					title="Previous match (Shift+Enter)"
					aria-label="Previous match"
					disabled={!findTotal}
					onclick={findPrev}
				>
					<IconChevronUp size={15} />
				</button>
				<button
					class={SEARCH_BTN}
					title="Next match (Enter)"
					aria-label="Next match"
					disabled={!findTotal}
					onclick={findNext}
				>
					<IconChevronDown size={15} />
				</button>
				<button class={SEARCH_BTN} title="Close (Esc)" aria-label="Close find" onclick={closeFind}>
					<IconX size={15} />
				</button>
			</div>
		{/if}

		{#if errorMsg}
			<div
				class="bg-muted/40 absolute inset-0 overflow-auto p-6"
			>
				<div class="border-destructive/30 bg-destructive/5 mx-auto max-w-prose rounded-lg border p-4">
					<p class="text-destructive text-sm font-medium">Could not display the PDF.</p>
					<pre
						class="text-muted-foreground mt-2 overflow-auto font-mono text-[11px] whitespace-pre-wrap">{errorMsg}</pre>
				</div>
			</div>
		{/if}

		{#if loading && !hasRendered}
			<div
				class="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-xs"
			>
				Rendering…
			</div>
		{/if}
	</div>
</div>

<style>
	/* Reserve the scrollbar gutter so it never reflows the fit-width calc. */
	.glyphx-pdf-container {
		scrollbar-gutter: stable;
		background: var(--color-muted, transparent);
	}

	/* Page chrome — we own it (PDFViewer renders borderless via removePageBorders). */
	:global(.glyphx-pdf-container .pdfViewer .page) {
		margin: 1.25rem auto;
		border: 1px solid var(--color-border);
		border-radius: 3px;
		background: var(--color-card);
		box-shadow: 0 1px 3px color-mix(in srgb, var(--color-foreground) 12%, transparent);
		overflow: clip;
	}

	/* Selection tint via our brand token (not a hardcoded colour). */
	:global(.glyphx-pdf-container .textLayer ::selection) {
		background: color-mix(in srgb, var(--color-primary) 30%, transparent);
	}

	/* Forward-sync flash (source → PDF). */
	:global(.glyphx-sync-flash) {
		position: absolute;
		z-index: 5;
		pointer-events: none;
		border-radius: 3px;
		background: color-mix(in srgb, var(--color-primary) 30%, transparent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 45%, transparent);
		animation: glyphx-sync-fade 1.5s ease-out forwards;
	}
	@keyframes -global-glyphx-sync-fade {
		0% {
			opacity: 0;
		}
		12% {
			opacity: 1;
		}
		70% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}
</style>
