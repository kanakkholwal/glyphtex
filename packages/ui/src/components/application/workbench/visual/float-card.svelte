<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import type { FloatAlignment, FloatBlock, Inline, Patch } from '@glyphtex/ui/tex-doc';
	import {
		IconAlignCenter,
		IconAlignLeft,
		IconAlignRight,
		IconCode,
		IconPhoto,
		IconPhotoPlus,
		IconSettings,
		IconTable,
		IconUpload
	} from '@tabler/icons-svelte';

	import { classifyFile } from '../../file-kinds';
	import type { WorkbenchController } from '../controller.svelte';
	import BlockEditor from './block-editor.svelte';
	import TableGrid from './table-grid.svelte';

	type TexDocModule = typeof import('@glyphtex/ui/tex-doc');

	/** Every control patches the one command it owns, so placement, subfigures and
	 *  hand-tuned spacing survive an edit to the caption beside them. */
	let {
		block,
		source,
		ctrl,
		tex,
		onpatch,
		onopensource,
		onlocalpatch,
		onatom
	}: {
		block: FloatBlock;
		source: string;
		ctrl: WorkbenchController;
		tex: TexDocModule | undefined;
		/** A list, because a control can need two edits: wrapping a figure also has
		 *  to put `\usepackage{wrapfig}` in the preamble. */
		onpatch: (patches: (Patch | null)[]) => void;
		onopensource: () => void;
		/** One span, typed into: a cell or the caption. Must not reparse the
		 *  document under the caret. */
		onlocalpatch?: (patch: Patch | null) => void;
		/** A cell's maths or citation was clicked; the pane owns that editor. */
		onatom?: (element: HTMLElement) => void;
	} = $props();

	const isTable = $derived(block.environment.startsWith('table'));
	const isWrapped = $derived(block.environment.startsWith('wrap'));

	// LaTeX conventionally omits the extension so the driver can choose the file;
	// the preview has to put it back to find the bytes.
	const EXTENSIONS = ['', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.pdf'];

	// Remembers which extension answered, so remounting a document full of figures
	// does not repeat eight rejected reads per figure.
	const resolved = new Map<string, string | null>();

	const imageFiles = $derived(
		ctrl.files.files.filter((f) => classifyFile(f.name) === 'image').map((f) => f.name)
	);

	let preview = $state<string>();
	let previewFor = $state<string>();
	let missing = $state(false);

	// Resolve the graphic to bytes and hand the browser an object URL. Revoked on
	// change: these hold the whole image in memory until they are.
	$effect(() => {
		const path = block.graphic;
		const read = ctrl.readFileBytes;
		if (!path || !read) {
			preview = undefined;
			return;
		}
		let url: string | undefined;
		let cancelled = false;

		void (async () => {
			const known = resolved.get(path);
			const candidates = known === undefined ? EXTENSIONS : known === null ? [] : [known];
			for (const extension of candidates) {
				try {
					const bytes = await read(path + extension);
					if (cancelled) return;
					resolved.set(path, extension);
					url = URL.createObjectURL(new Blob([bytes as BlobPart]));
					preview = url;
					previewFor = path;
					missing = false;
					return;
				} catch {
					// Try the next extension; only the last failure means anything.
				}
			}
			if (!cancelled) {
				resolved.set(path, null);
				preview = undefined;
				missing = true;
			}
		})();

		return () => {
			cancelled = true;
			if (url) URL.revokeObjectURL(url);
		};
	});

	let picking = $state(false);
	let options = $state(false);

	// Read off this float's own slice rather than the whole document: `source`
	// changes on every keystroke anywhere, and these run once per float.
	const slice = $derived(source.slice(block.span.from, block.span.to));
	const grid = $derived(tex && isTable ? tex.readTable(source, block) : null);
	const width = $derived(
		/\\includegraphics\s*\*?\s*\[[^\]]*?width\s*=\s*([^,\]]+)[^\]]*\]/.exec(slice)?.[1].trim() ?? ''
	);
	const alignment = $derived<FloatAlignment>(
		(/\\(centering|raggedright|raggedleft)\b/.exec(slice)?.[1] as FloatAlignment) ?? null
	);
	const placement = $derived(/^\\begin\s*\{[^}]*\}[ \t]*\[([^\]]*)\]/.exec(slice)?.[1] ?? '');
	const label = $derived(/\\label\s*\{([^}]*)\}/.exec(slice)?.[1] ?? '');

	const one = (make: (t: TexDocModule) => Patch | null) => {
		if (tex) onpatch([make(tex)]);
	};

	function chooseImage(path: string) {
		picking = false;
		// Strip the extension: that is what LaTeX wants, and it keeps the source
		// portable across the drivers that pick their own format.
		one((t) => t.setFloatGraphic(source, block, path.replace(/\.[^./]+$/, '')));
	}

	async function uploadImage() {
		picking = false;
		const added = await ctrl.onAddFiles?.('image/*');
		const first = Array.isArray(added) ? added[0] : undefined;
		if (first) chooseImage(first);
	}

	const WIDTHS = [
		{ value: '0.4\\linewidth', label: '40%' },
		{ value: '0.6\\linewidth', label: '60%' },
		{ value: '0.8\\linewidth', label: '80%' },
		{ value: '\\linewidth', label: 'Full' }
	];

	const ALIGNS: { id: FloatAlignment; label: string; icon: typeof IconAlignLeft }[] = [
		{ id: 'raggedright', label: 'Align left', icon: IconAlignLeft },
		{ id: 'centering', label: 'Centre', icon: IconAlignCenter },
		{ id: 'raggedleft', label: 'Align right', icon: IconAlignRight }
	];

	/** LaTeX names the command; the card has to name a direction. */
	const PLACEMENT_OF: Record<string, 'left' | 'center' | 'right'> = {
		centering: 'center',
		raggedright: 'left',
		raggedleft: 'right'
	};
	const PLACE: Record<string, string> = {
		left: 'justify-start',
		center: 'justify-center',
		right: 'justify-end'
	};

	const RULE_STYLES = [
		{ id: 'none', label: 'None' },
		{ id: 'rows', label: 'Rows' },
		{ id: 'grid', label: 'Grid' }
	];

	const PLACEMENTS = [
		{ value: 'h', label: 'Here' },
		{ value: 't', label: 'Top' },
		{ value: 'b', label: 'Bottom' },
		{ value: 'p', label: 'Own page' },
		{ value: 'htbp', label: 'Anywhere' }
	];

	const WRAPS = [
		{ value: '', label: 'None' },
		{ value: 'l', label: 'Text right' },
		{ value: 'r', label: 'Text left' }
	];

	/** Wrapping needs a package the document may not load yet, so the toggle
	 *  carries that edit with it rather than producing source that will not build. */
	function setWrap(side: string) {
		if (!tex) return;
		const preambleEnd = source.indexOf('\\begin{document}');
		onpatch([
			side && preambleEnd > 0 ? tex.ensurePackage(source, preambleEnd, 'wrapfig') : null,
			tex.setFloatWrap(source, block, (side || null) as 'l' | 'r' | null)
		]);
	}

	/** A label is a key, not prose: anything that would need escaping inside
	 *  `\label{…}` is dropped rather than written and left to fail at compile. */
	const labelKey = (value: string) => value.replace(/[\\{}%#$&~^_\s]+/g, '-').replace(/^-|-$/g, '');

	// Read off the source, not off `block.caption`: a caption keystroke patches one
	// span without reparsing, so the model is a moment behind and the slice is not.
	const captionText = $derived(tex ? (tex.floatCaption(source, block) ?? '') : '');
	const captionRuns = $derived(tex ? tex.parseInlineFragment(captionText) : []);

	/** Printed like any other inline content, which is what escapes a typed `%`
	 *  instead of commenting out the rest of the float. */
	function commitCaption(runs: Inline[]) {
		if (!tex) return;
		const text = tex.printInlines(runs).replace(/\s+/g, ' ').trim();
		if (text === captionText.trim()) return;
		const patch = tex.setFloatCaption(source, block, text);
		if (onlocalpatch) onlocalpatch(patch);
		else onpatch([patch]);
	}

	const CHIP =
		'flex h-7 min-w-9 items-center justify-center rounded px-2 text-xs transition-colors';
	const OFF = 'text-muted-foreground hover:text-foreground hover:bg-accent/60';
	const ON = 'bg-accent text-foreground';
	const FIELD =
		'border-border text-foreground focus-visible:border-brand w-full rounded-md border bg-transparent px-2 py-1 text-xs outline-none';
</script>

<!-- No `overflow-hidden`: the card's own popovers open past its edges, and
     clipping them cut the Options panel in half. -->
<figure class="border-border bg-surface-soft group/float mt-5 rounded-lg border">
	<div
		class="text-muted-foreground border-border flex items-center gap-2 border-b px-3 py-1.5 text-xs font-medium"
	>
		{#if isTable}<IconTable size={14} />{:else}<IconPhoto size={14} />{/if}
		{block.environment}
		{#if label}<span class="text-faint font-mono">#{label}</span>{/if}
		<div class="ml-auto flex items-center gap-1">
			{#if !isTable}
				<div class="relative">
					<Button
						size="sm"
						variant="ghost"
						class="h-7 gap-1.5 px-2 text-xs"
						onclick={() => (picking = !picking)}
					>
						<IconPhotoPlus size={14} />
						{block.graphic ? 'Replace' : 'Add image'}
					</Button>
					{#if picking}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="fixed inset-0 z-40"
							onpointerdown={() => (picking = false)}
							role="presentation"
						></div>
						<div
							class="border-border bg-popover absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-lg border shadow-lg"
						>
							<div class="max-h-56 overflow-y-auto py-1">
								{#each imageFiles as name (name)}
									<button
										type="button"
										class="text-muted-foreground hover:bg-accent hover:text-foreground block w-full truncate px-3 py-1.5 text-left text-sm"
										onclick={() => chooseImage(name)}
									>
										{name}
									</button>
								{:else}
									<p class="text-muted-foreground px-3 py-2 text-xs">
										No images in this document yet.
									</p>
								{/each}
							</div>
							{#if ctrl.onAddFiles}
								<button
									type="button"
									class="border-border text-foreground hover:bg-accent flex w-full items-center gap-2 border-t px-3 py-2 text-sm"
									onclick={uploadImage}
								>
									<IconUpload size={15} />
									Upload an image…
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
			<Button
				size="sm"
				variant="ghost"
				class="h-7 gap-1.5 px-2 text-xs"
				onclick={onopensource}
				aria-label="Edit this {isTable ? 'table' : 'figure'} in the LaTeX view"
			>
				<IconCode size={14} />
				LaTeX
			</Button>
		</div>
	</div>

	{#if isTable}
		{#if grid}
			<TableGrid
				{grid}
				tex={tex!}
				align={PLACEMENT_OF[alignment ?? 'raggedright']}
				{onatom}
				oncellpatch={onlocalpatch}
				onpatch={(patch) => onpatch([patch])}
			/>
		{:else}
			<div class="text-muted-foreground px-4 py-3 text-xs">
				This table uses spanning cells or a column spec the grid editor cannot represent, so it is
				edited in the LaTeX view.
			</div>
		{/if}
	{:else}
		<div
			class="flex min-h-28 items-center px-4 py-4 {PLACE[PLACEMENT_OF[alignment ?? 'centering']]}"
		>
			{#if preview}
				<img
					src={preview}
					alt={block.caption ?? previewFor ?? 'Figure'}
					class="max-h-72 max-w-full rounded object-contain"
				/>
			{:else if block.graphic}
				<div class="text-muted-foreground text-center text-xs">
					<IconPhoto size={22} class="mx-auto mb-1.5 opacity-60" />
					<p class="font-mono">{block.graphic}</p>
					{#if missing}
						<p class="text-faint mt-1">
							Not in this document. It will still compile if TeX can find it.
						</p>
					{/if}
				</div>
			{:else}
				<p class="text-muted-foreground text-xs">No image yet.</p>
			{/if}
		</div>
	{/if}

	<!-- Quiet until you are working on this float: a document of twenty figures
	     should not read as twenty control panels. -->
	<div
		class="border-border flex flex-wrap items-center gap-1 border-t px-3 py-1.5 opacity-45 transition-opacity group-focus-within/float:opacity-100 group-hover/float:opacity-100"
	>
		{#if !isTable}
			<span class="text-faint mr-1 text-xs">Width</span>
			{#each WIDTHS as option (option.value)}
				<button
					type="button"
					aria-pressed={width === option.value}
					class="{CHIP} {width === option.value ? ON : OFF}"
					onclick={() => one((t) => t.setFloatWidth(source, block, option.value))}
				>
					{option.label}
				</button>
			{/each}
			<span class="bg-border/70 mx-1.5 h-4 w-px"></span>
		{:else if grid}
			{@const style = grid.borders ? 'grid' : grid.ruleAfter ? 'rows' : 'none'}
			<span class="text-faint mr-1 text-xs">Rules</span>
			{#each RULE_STYLES as option (option.id)}
				<button
					type="button"
					aria-pressed={style === option.id}
					class="{CHIP} {style === option.id ? ON : OFF}"
					onclick={() =>
						onpatch([
							tex!.setTableStyle(grid, {
								rules: option.id !== 'none',
								borders: option.id === 'grid'
							})
						])}
				>
					{option.label}
				</button>
			{/each}
			<span class="bg-border/70 mx-1.5 h-4 w-px"></span>
		{/if}

		{#each ALIGNS as option (option.label)}
			{@const Icon = option.icon}
			<button
				type="button"
				title={option.label}
				aria-label={option.label}
				aria-pressed={alignment === option.id}
				class="{CHIP} {alignment === option.id ? ON : OFF}"
				onclick={() =>
					one((t) =>
						t.setFloatAlignment(source, block, alignment === option.id ? null : option.id)
					)}
			>
				<Icon size={14} />
			</button>
		{/each}

		<div class="relative ml-auto">
			<button
				type="button"
				aria-label="Float options"
				aria-expanded={options}
				class="{CHIP} {options ? ON : OFF} gap-1.5"
				onclick={() => (options = !options)}
			>
				<IconSettings size={14} />
				Options
			</button>
			{#if options}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="fixed inset-0 z-40"
					onpointerdown={() => (options = false)}
					role="presentation"
				></div>
				<div
					class="border-border bg-popover absolute right-0 bottom-full z-50 mb-1 w-64 rounded-lg border p-2.5 shadow-lg"
					role="dialog"
					aria-label="Float options"
				>
					<p class="text-faint mb-1 text-[0.6875rem] font-medium tracking-wide uppercase">
						Placement
					</p>
					<div class="flex flex-wrap gap-1">
						{#each PLACEMENTS as option (option.value)}
							<button
								type="button"
								aria-pressed={placement === option.value}
								class="{CHIP} {placement === option.value ? ON : OFF}"
								onclick={() => one((t) => t.setFloatPlacement(source, block, option.value))}
							>
								{option.label}
							</button>
						{/each}
					</div>

					{#if !isTable}
						<p class="text-faint mt-2.5 mb-1 text-[0.6875rem] font-medium tracking-wide uppercase">
							Text wrap
						</p>
						<div class="flex flex-wrap gap-1">
							{#each WRAPS as option (option.value)}
								{@const active = option.value
									? isWrapped && slice.includes(`{${option.value}}`)
									: !isWrapped}
								<button
									type="button"
									aria-pressed={active}
									class="{CHIP} {active ? ON : OFF}"
									onclick={() => setWrap(option.value)}
								>
									{option.label}
								</button>
							{/each}
						</div>
						<p class="text-faint mt-1 text-[0.6875rem]">Wrapping loads the wrapfig package.</p>
					{/if}

					<p class="text-faint mt-2.5 mb-1 text-[0.6875rem] font-medium tracking-wide uppercase">
						Label
					</p>
					<input
						value={label}
						placeholder={isTable ? 'tab:name' : 'fig:name'}
						aria-label="Reference label"
						class="{FIELD} font-mono"
						onchange={(e) =>
							one((t) =>
								t.setFloatLabel(source, block, labelKey((e.currentTarget as HTMLInputElement).value))
							)}
					/>
					<p class="text-faint mt-1 text-[0.6875rem]">
						Cross-reference it with \ref{'{'}{label || (isTable ? 'tab:name' : 'fig:name')}{'}'}.
					</p>
				</div>
			{/if}
		</div>
	</div>

	<figcaption class="border-border relative border-t px-3 py-2">
		<span class="text-faint mr-1.5 text-xs">Caption</span>
		<BlockEditor
			runs={captionRuns}
			tag="span"
			label="{isTable ? 'Table' : 'Figure'} caption"
			placeholder="Describe this {isTable ? 'table' : 'figure'}"
			attributes={{ 'data-float-caption': '' }}
			class="text-foreground hover:bg-accent/60 focus-visible:bg-accent/60 relative inline-block min-w-48 rounded-sm text-sm"
			oninput={commitCaption}
			onatom={(el) => onatom?.(el)}
		/>
	</figcaption>
</figure>
