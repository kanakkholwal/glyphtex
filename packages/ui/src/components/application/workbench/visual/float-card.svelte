<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import type { FloatBlock, Patch } from '@glyphtex/ui/tex-doc';
	import {
		IconCode,
		IconPhoto,
		IconPhotoPlus,
		IconTable,
		IconUpload
	} from '@tabler/icons-svelte';

	import { classifyFile } from '../../file-kinds';
	import type { WorkbenchController } from '../controller.svelte';

	/**
	 * A figure or table, editable where it can be: the caption, the image and its
	 * width. The environment around them is never reprinted — placement options,
	 * subfigures and hand-tuned spacing survive untouched, because each control
	 * patches only the one command it owns.
	 */
	let {
		block,
		source,
		ctrl,
		onpatch,
		onopensource
	}: {
		block: FloatBlock;
		source: string;
		ctrl: WorkbenchController;
		onpatch: (patch: Patch | null) => void;
		onopensource: () => void;
	} = $props();

	const isTable = $derived(block.environment.startsWith('table'));

	// LaTeX conventionally omits the extension so the driver can choose the file;
	// the preview has to put it back to find the bytes.
	const EXTENSIONS = ['', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.pdf'];

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
			for (const extension of EXTENSIONS) {
				try {
					const bytes = await read(path + extension);
					if (cancelled) return;
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
	let width = $state<string>();

	$effect(() => {
		void import('@glyphtex/ui/tex-doc').then((tex) => {
			width = tex.floatWidth(source, block) ?? undefined;
		});
	});

	async function patchWith(
		make: (tex: typeof import('@glyphtex/ui/tex-doc')) => Patch | null
	) {
		onpatch(make(await import('@glyphtex/ui/tex-doc')));
	}

	function chooseImage(path: string) {
		picking = false;
		// Strip the extension: that is what LaTeX wants, and it keeps the source
		// portable across the drivers that pick their own format.
		void patchWith((tex) => tex.setFloatGraphic(source, block, path.replace(/\.[^./]+$/, '')));
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

	let captionEl = $state<HTMLElement>();

	// The caption is plain text, not inline runs: it lives inside `\caption{…}`,
	// which this card patches as a whole rather than reprinting the float.
	$effect(() => {
		const text = block.caption ?? '';
		if (captionEl && document.activeElement !== captionEl && captionEl.textContent !== text) {
			captionEl.textContent = text;
		}
	});

	function commitCaption() {
		const text = (captionEl?.textContent ?? '').replace(/\s+/g, ' ').trim();
		if (text === (block.caption ?? '')) return;
		void patchWith((tex) => tex.setFloatCaption(source, block, text));
	}
</script>

<figure class="border-border bg-surface-soft mt-5 overflow-hidden rounded-lg border">
	<div
		class="text-muted-foreground border-border flex items-center gap-2 border-b px-3 py-1.5 text-xs font-medium"
	>
		{#if isTable}<IconTable size={14} />{:else}<IconPhoto size={14} />{/if}
		{block.environment}
		{#if block.label}<span class="text-faint font-mono">#{block.label}</span>{/if}
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

	{#if !isTable}
		<div class="flex min-h-28 items-center justify-center px-4 py-4">
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
							Not in this document — it will still compile if TeX can find it.
						</p>
					{/if}
				</div>
			{:else}
				<p class="text-muted-foreground text-xs">No image yet.</p>
			{/if}
		</div>

		{#if block.graphic}
			<div class="border-border flex items-center gap-1 border-t px-3 py-1.5">
				<span class="text-faint mr-1 text-xs">Width</span>
				{#each WIDTHS as option (option.value)}
					<button
						type="button"
						aria-pressed={width === option.value}
						class="rounded px-2 py-0.5 text-xs {width === option.value
							? 'bg-accent text-foreground'
							: 'text-muted-foreground hover:text-foreground'}"
						onclick={() => {
							width = option.value;
							void patchWith((tex) => tex.setFloatWidth(source, block, option.value));
						}}
					>
						{option.label}
					</button>
				{/each}
			</div>
		{/if}
	{:else}
		<div class="text-muted-foreground px-4 py-3 text-xs">
			Tables are edited in the LaTeX view — the visual editor would have to guess at column
			specs and merged cells.
		</div>
	{/if}

	<figcaption class="border-border border-t px-3 py-2">
		<span class="text-faint mr-1.5 text-xs">Caption</span>
		<span
			bind:this={captionEl}
			contenteditable="true"
			role="textbox"
			tabindex="0"
			aria-label="Figure caption"
			data-float-caption
			class="text-foreground text-sm outline-none"
			onblur={commitCaption}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					(e.currentTarget as HTMLElement).blur();
				}
			}}
		></span>
	</figcaption>
</figure>
