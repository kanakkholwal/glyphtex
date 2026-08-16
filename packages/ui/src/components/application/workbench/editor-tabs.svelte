<script lang="ts">
	import {
		IconChevronDown,
		IconFile,
		IconFileText,
		IconFileTypePdf,
		IconPhotoPlus,
		IconPlus,
		IconTarget,
		IconX
	} from "@tabler/icons-svelte";
	import { Tooltip, TooltipContent, TooltipTrigger } from "@glyphtex/ui/tooltip";
	import { toast } from "@glyphtex/ui/sonner";
	import { tick } from "svelte";

	import { classifyFile, type FileKind } from "../file-kinds";
	import { shortcutLabel } from "../shortcuts";
	import type { FileStore } from "./files.svelte";
	import TabMenu, { type TabAction } from "./tab-menu.svelte";

	/** The open-file strip. Shared chrome: it says which file you are editing, in
	 *  either editor, so switching surface never changes the answer. */
	// The chips look identical in both editors: only the rail behind them changes
	// weight, which is the whole point of moving the strip above the mode split.
	let {
		files,
		onnew,
		controls = "glyphtex-doc-surface"
	}: {
		files: FileStore;
		onnew?: () => void;
		/** Id of the surface these tabs drive, for `aria-controls`. */
		controls?: string;
	} = $props();

	const icons: Record<FileKind, typeof IconFile> = {
		latex: IconFileText,
		markdown: IconFileText,
		text: IconFile,
		image: IconPhotoPlus,
		pdf: IconFileTypePdf,
		binary: IconFile
	};

	let scroller = $state<HTMLElement>();
	let tabEls = $state<Record<string, HTMLElement | undefined>>({});
	let overflowing = $state(false);
	let menu = $state<{ x: number; y: number; id: string } | null>(null);
	let openList = $state<{ x: number; y: number } | null>(null);

	const order = $derived(files.openTabFiles.map((f) => f.id));

	// --- Active pill ------------------------------------------------------------
	// The same raised-card pill the Segmented control and the mode switch use: one
	// element that slides, so the strip reads as a single object rather than N
	// boxes. It is also the only thing here allowed to animate, since switching
	// files is a hundreds-of-times-a-day action.
	let pill = $state({ x: 0, w: 0, ready: false });
	// The first measurement snaps; only later moves slide, or the pill flies in
	// from the left edge on mount.
	let pillSettled = $state(false);

	$effect(() => {
		void files.openTabFiles;
		const id = files.activeId;
		if (!tabEls[id]) {
			pill = { x: 0, w: 0, ready: false };
			pillSettled = false;
			return;
		}
		void tick().then(() => {
			const live = tabEls[id];
			if (!live || files.activeId !== id) return;
			pill = { x: live.offsetLeft, w: live.offsetWidth, ready: true };
			queueMicrotask(() => (pillSettled = true));
			// Opening a file from the Explorer or ⌘K can activate a tab scrolled out
			// of the strip; without this the click reads as a no-op.
			live.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
		});
	});

	// Re-measured on both axes of change: the strip resizing, and a tab arriving.
	$effect(() => {
		void files.openTabFiles;
		const el = scroller;
		if (!el) return;
		const measure = () => (overflowing = el.scrollWidth > el.clientWidth + 1);
		void tick().then(measure);
		if (typeof ResizeObserver === "undefined") return;
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	});

	// --- Drag to reorder --------------------------------------------------------
	// A caret marks where the tab will land rather than live-shuffling the strip:
	// the drop target stays legible and nothing commits until release.
	const DRAG_THRESHOLD = 6;
	let drag = $state<{ id: string; startX: number; dx: number; moved: boolean } | null>(null);
	let dropBefore = $state<string | null | undefined>(undefined);

	const caretX = $derived.by(() => {
		if (dropBefore === undefined) return null;
		if (dropBefore === null) {
			const last = tabEls[order[order.length - 1]];
			return last ? last.offsetLeft + last.offsetWidth - 1 : 0;
		}
		return tabEls[dropBefore]?.offsetLeft ?? null;
	});

	function dropTargetAt(x: number): string | null {
		for (const id of order) {
			const el = tabEls[id];
			if (!el || id === drag?.id) continue;
			const r = el.getBoundingClientRect();
			if (x < r.left + r.width / 2) return id;
		}
		return null;
	}

	function onTabPointerDown(event: PointerEvent, id: string): void {
		if (event.button !== 0 || menu) return;
		drag = { id, startX: event.clientX, dx: 0, moved: false };
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function onTabPointerMove(event: PointerEvent): void {
		if (!drag) return;
		const dx = event.clientX - drag.startX;
		if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
		drag = { ...drag, dx, moved: true };
		dropBefore = dropTargetAt(event.clientX);
	}

	function onTabPointerUp(): void {
		const active = drag;
		const target = dropBefore;
		drag = null;
		dropBefore = undefined;
		if (active?.moved && target !== undefined) files.moveTab(active.id, target);
	}

	function onTabClick(id: string): void {
		// A drag that ends on the tab it started from is still a drag, not a click.
		if (drag?.moved) return;
		void files.openFile(id);
	}

	// --- Keyboard ---------------------------------------------------------------
	// Roving tabindex: the strip is one Tab stop and arrows move within it. Without
	// it, reaching the editor costs two stops per open file.
	function activate(id: string | undefined): void {
		if (!id) return;
		void files.openFile(id);
		void tick().then(() => tabEls[id]?.querySelector<HTMLButtonElement>('[role="tab"]')?.focus());
	}

	function onKeyDown(event: KeyboardEvent, id: string): void {
		const at = order.indexOf(id);
		if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
			event.preventDefault();
			activate(order[(at + (event.key === "ArrowRight" ? 1 : -1) + order.length) % order.length]);
		} else if (event.key === "Home" || event.key === "End") {
			event.preventDefault();
			activate(event.key === "Home" ? order[0] : order[order.length - 1]);
		} else if (event.key === "Delete" || event.key === "Backspace") {
			event.preventDefault();
			files.closeTab(id);
		} else if (event.key === "F10" && event.shiftKey) {
			event.preventDefault();
			const r = tabEls[id]?.getBoundingClientRect();
			if (r) menu = { x: r.left, y: r.bottom, id };
		}
	}

	// --- Context menu -----------------------------------------------------------
	function runTabAction(action: TabAction): void {
		const open = menu;
		menu = null;
		if (!open) return;
		const file = files.files.find((f) => f.id === open.id);
		if (action === "close") files.closeTab(open.id);
		else if (action === "others") files.closeOtherTabs(open.id);
		else if (action === "right") files.closeTabsToRight(open.id);
		else if (action === "all") files.closeAllTabs();
		else if (action === "main") void files.setMain(open.id);
		else if (action === "reveal") {
			if (file?.path) void files.project?.revealInOS?.(file.path);
		} else if (action === "copy") {
			void navigator.clipboard
				?.writeText(file?.path ?? file?.name ?? "")
				.then(() => toast.success("Path copied"))
				.catch(() => toast.error("Could not copy the path"));
		}
	}
</script>

<div class="flex min-w-0 flex-1 items-stretch">
	<div
		bind:this={scroller}
		class="glyphtex-tab-strip relative flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1 py-1 {overflowing
			? 'glyphtex-tab-strip--faded'
			: ''}"
		role="tablist"
		aria-label="Open files"
		aria-orientation="horizontal"
	>
		<!-- Behind the chips, so the active one is a surface they sit on rather than a
		     rule drawn under one of them. -->
		{#if pill.ready}
			<span
				class="bg-card dark:bg-surface shadow-craft-sm pointer-events-none absolute top-1 left-0 rounded-md {pillSettled &&
				!drag?.moved
					? 'glyphtex-tab-pill'
					: ''}"
				style:width="{pill.w}px"
				style:height="calc(100% - 0.5rem)"
				style:transform="translateX({pill.x}px)"
				aria-hidden="true"
			></span>
		{/if}
		{#each files.openTabFiles as file (file.id)}
			{@const active = file.id === files.activeId}
			{@const dirty = files.dirtyIds.has(file.id)}
			{@const Icon = icons[classifyFile(file.name)]}
			{@const label = files.tabLabels.get(file.id)}
			{@const dragging = drag?.moved && drag.id === file.id}
			<div
				bind:this={tabEls[file.id]}
				class="glyphtex-tab-slot group/tab relative z-10 flex h-7 shrink-0 items-center gap-1.5 rounded-md pr-1 pl-2.5 text-xs {active
					? 'text-foreground font-medium'
					: 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'} {dragging
					? 'bg-card dark:bg-surface shadow-craft-md z-30'
					: 'ease-craft transition-[background-color,color] duration-150 motion-reduce:transition-none'}"
				style:transform={dragging ? `translateX(${drag?.dx}px)` : undefined}
				role="presentation"
				oncontextmenu={(e) => {
					e.preventDefault();
					menu = { x: e.clientX, y: e.clientY, id: file.id };
				}}
				onpointerdown={(e) => {
					if (e.button === 1) e.preventDefault();
				}}
				onauxclick={(e) => {
					// Middle-click closes. `auxclick`, not `pointerdown`: preventing the
					// pointer event does not stop Chrome's autoscroll on Windows.
					if (e.button !== 1) return;
					e.preventDefault();
					files.closeTab(file.id);
				}}
			>
				<button
					class="glyphtex-tab flex min-w-0 items-center gap-1.5 py-0 pr-1 outline-none"
					role="tab"
					aria-selected={active}
					aria-controls={controls}
					tabindex={active ? 0 : -1}
					title={file.id === files.mainId ? `${file.name} · main file` : file.name}
					onclick={() => onTabClick(file.id)}
					onpointerdown={(e) => onTabPointerDown(e, file.id)}
					onpointermove={onTabPointerMove}
					onpointerup={onTabPointerUp}
					onpointercancel={onTabPointerUp}
					onkeydown={(e) => onKeyDown(e, file.id)}
				>
					{#if file.id === files.mainId}
						<!-- Which file the compiler actually reads. Held at 60%: the shape
						     carries the meaning, and at full strength the accent out-shouts the
						     pill and reads as "selected" instead of "main". -->
						<IconTarget size={14} class="text-brand/60 shrink-0" />
					{:else}
						<Icon size={14} class="shrink-0 opacity-70" />
					{/if}
					<span class="max-w-44 truncate">{label?.leaf ?? file.name}</span>
					{#if label?.dir}
						<!-- Shown only when another open tab shares this leaf, so it appears
						     exactly when the name alone stops being an answer. -->
						<span class="text-faint max-w-28 shrink-0 truncate">{label.dir}</span>
					{/if}
				</button>

				{#if files.canCloseTab}
					<button
						class="glyphtex-tab-close group/close hover:bg-accent ease-craft grid size-6 shrink-0 place-items-center rounded-[5px] transition-[background-color,opacity,transform] duration-150 motion-reduce:transition-none {dirty ||
						active
							? ''
							: 'opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100'}"
						tabindex="-1"
						title="Close ({shortcutLabel('close-tab')})"
						aria-label="Close {label?.leaf ?? file.name}"
						onclick={() => files.closeTab(file.id)}
					>
						{#if dirty}
							<!-- The dot becomes an X on the close button's *own* hover: swapping it
							     on tab hover erases the unsaved signal exactly as you point at it. -->
							<span
								class="bg-foreground/60 size-1.5 rounded-full group-hover/close:hidden"
								aria-hidden="true"
							></span>
							<IconX size={13} class="hidden group-hover/close:block" />
						{:else}
							<IconX size={13} />
						{/if}
					</button>
				{:else if dirty}
					<span class="grid size-6 place-items-center" title="Unsaved changes">
						<span class="bg-foreground/60 size-1.5 rounded-full" aria-hidden="true"></span>
					</span>
				{/if}
			</div>
		{/each}

		{#if caretX !== null}
			<span
				class="bg-brand pointer-events-none absolute inset-y-1.5 left-0 z-40 w-0.5 rounded-full"
				style:transform="translateX({caretX}px)"
				aria-hidden="true"
			></span>
		{/if}
	</div>

	<!-- Outside the scroller: both used to be reachable only by scrolling to the end. -->
	<div class="flex shrink-0 items-center gap-0.5 pr-1.5 pl-0.5">
		{#if overflowing}
			<span class="bg-border/60 mr-0.5 h-4 w-px shrink-0" aria-hidden="true"></span>
			<Tooltip delayDuration={400}>
				<TooltipTrigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="text-muted-foreground hover:bg-accent/60 hover:text-foreground ease-craft grid size-7 shrink-0 place-items-center rounded-md transition-colors duration-150 motion-reduce:transition-none"
							aria-label="All open files"
							aria-haspopup="menu"
							onclick={(e) => {
								const r = e.currentTarget.getBoundingClientRect();
								menu = null;
								openList = { x: r.right - 224, y: r.bottom + 4 };
							}}
						>
							<IconChevronDown size={15} />
						</button>
					{/snippet}
				</TooltipTrigger>
				<TooltipContent side="bottom">All open files</TooltipContent>
			</Tooltip>
		{/if}

		{#if onnew}
			<Tooltip delayDuration={400}>
				<TooltipTrigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="text-muted-foreground hover:bg-accent/60 hover:text-foreground ease-craft grid size-7 shrink-0 place-items-center rounded-md transition-colors duration-150 motion-reduce:transition-none"
							aria-label="New file"
							onclick={() => onnew?.()}
						>
							<IconPlus size={15} />
						</button>
					{/snippet}
				</TooltipTrigger>
				<TooltipContent side="bottom">New file ({shortcutLabel('new-file')})</TooltipContent>
			</Tooltip>
		{/if}
	</div>
</div>

{#if menu}
	{@const target = files.files.find((f) => f.id === menu?.id)}
	{@const at = order.indexOf(menu.id)}
	<TabMenu
		x={menu.x}
		y={menu.y}
		canClose={files.canCloseTab}
		hasOthers={order.length > 1}
		hasRight={at > -1 && at < order.length - 1}
		canSetMain={classifyFile(target?.name ?? '') === 'latex'}
		isMain={menu.id === files.mainId}
		canReveal={Boolean(files.project?.revealInOS && target?.path)}
		onpick={runTabAction}
		onclose={() => (menu = null)}
	/>
{/if}

{#if openList}
	<div class="fixed inset-0 z-40" role="presentation" onpointerdown={() => (openList = null)}></div>
	<div
		class="border-border bg-popover glyphtex-tab-menu fixed z-50 max-h-80 w-56 overflow-y-auto rounded-lg border p-1 shadow-lg"
		style:left="{Math.max(8, openList.x)}px"
		style:top="{openList.y}px"
		role="menu"
		aria-label="All open files"
	>
		{#each files.openTabFiles as file (file.id)}
			{@const Icon = icons[classifyFile(file.name)]}
			<button
				type="button"
				role="menuitem"
				class="hover:bg-accent focus-visible:bg-accent flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[0.8125rem] outline-none {file.id ===
				files.activeId
					? 'text-foreground'
					: 'text-muted-foreground'}"
				onclick={() => {
					openList = null;
					void files.openFile(file.id);
				}}
			>
				<Icon size={14} class="shrink-0 opacity-70" />
				<span class="min-w-0 flex-1 truncate">{file.name}</span>
				{#if files.dirtyIds.has(file.id)}
					<span class="bg-foreground/60 size-1.5 shrink-0 rounded-full" aria-hidden="true"></span>
				{/if}
			</button>
		{/each}
	</div>
{/if}

<style>
	/* No visible scrollbar in a 36px strip; the edge fade is the affordance, and it
	   only appears when there is something past the edge. */
	.glyphtex-tab-strip {
		scrollbar-width: none;
	}
	.glyphtex-tab-strip::-webkit-scrollbar {
		display: none;
	}
	.glyphtex-tab-strip--faded {
		mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
	}

	/* Same curve and duration as the Segmented control's pill, so the two read as
	   one motion language rather than two components that happen to slide. */
	.glyphtex-tab-pill {
		transition:
			transform 200ms var(--ease-craft),
			width 200ms var(--ease-craft);
	}

	/* A tab arriving should not pop into existence; leaving is quicker than landing. */
	.glyphtex-tab-slot {
		animation: tab-in 160ms var(--ease-craft);
	}
	@keyframes tab-in {
		from {
			opacity: 0;
			transform: translateX(-6px);
		}
	}

	/* Confirms the press before the content swaps. The swap itself stays instant. */
	.glyphtex-tab {
		transition: transform 100ms var(--ease-craft);
	}
	.glyphtex-tab:active {
		transform: scale(0.98);
	}
	/* The ring belongs to the whole chip, not the label button inside it, or it
	   traces a smaller rectangle that ignores the chip's own corners. Inset, like
	   every other ring in the system, so it never bleeds into the next chip. */
	.glyphtex-tab:focus-visible {
		outline: none;
	}
	.glyphtex-tab-slot:has(.glyphtex-tab:focus-visible) {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}
	.glyphtex-tab-close:active {
		transform: scale(0.9);
	}

	.glyphtex-tab-menu {
		transform-origin: top left;
		animation: tab-menu-in 140ms var(--ease-craft);
	}
	@keyframes tab-menu-in {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.glyphtex-tab-pill,
		.glyphtex-tab {
			transition: none;
		}
		.glyphtex-tab-slot,
		.glyphtex-tab-menu {
			animation: none;
		}
	}
</style>
