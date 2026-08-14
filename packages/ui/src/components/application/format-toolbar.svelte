<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuShortcut,
		DropdownMenuTrigger
	} from '@glyphtex/ui/dropdown-menu';
	// Imported from the standalone templates module, not `@glyphtex/ui/tex-doc`:
	// that entry pulls in unified-latex, which the LaTeX view must not bundle.
	import { templateSource } from '@glyphtex/ui/tex-templates';
	import {
		IconBold,
		IconChevronDown,
		IconHeading,
		IconItalic,
		IconList,
		IconMath,
		IconMathFunction,
		IconMathSymbols,
		IconPlus,
		IconTypography,
		IconUnderline
	} from '@tabler/icons-svelte';

	/**
	 * FormatToolbar: a rich LaTeX formatting bar. The most common actions are
	 * direct buttons; the rest are grouped into portaled dropdown menus (same
	 * chrome as the file-tree menus). Each menu item shows the LaTeX command it
	 * inserts. Acts on the selection via the CodeEditor imperative API.
	 */
	let {
		wrap,
		insert,
		focusEditor
	}: {
		wrap?: (before: string, after?: string) => void;
		insert?: (text: string) => void;
		/** Called after a menu closes, to put the caret back where the edit landed. */
		focusEditor?: () => void;
	} = $props();

	const w =
		(before: string, after = '') =>
		() =>
			wrap?.(before, after);
	const i = (text: string) => () => insert?.(text);
	/** A shared block template, so this bar and the visual editor's `/` menu
	 *  insert byte-identical LaTeX. */
	const t = (id: string) => i(`${templateSource(id)}\n`);

	// A menu item's edit runs on select, but bits-ui then returns focus to the
	// trigger, which is what leaves the caret on the button. Reclaim it on close,
	// and only when something actually ran: Escape should still land on the trigger.
	let ranFromMenu = $state(false);
	const runItem = (item: Cmd) => () => {
		ranFromMenu = true;
		item.run();
	};
	function onMenuClose(event: Event) {
		if (!ranFromMenu) return;
		ranFromMenu = false;
		event.preventDefault();
		focusEditor?.();
	}

	type Cmd = { label: string; hint?: string; run: () => void };
	type ButtonCmd = { icon: typeof IconBold; label: string; run: () => void };
	type Cluster =
		| { kind: 'group'; actions: ButtonCmd[] }
		| { kind: 'menu'; icon: typeof IconBold; label: string; items: (Cmd | 'sep')[] };

	const clusters: Cluster[] = [
		{
			kind: 'group',
			actions: [
				{ icon: IconBold, label: 'Bold', run: w('\\textbf{', '}') },
				{ icon: IconItalic, label: 'Italic', run: w('\\textit{', '}') },
				{ icon: IconUnderline, label: 'Underline', run: w('\\underline{', '}') }
			]
		},
		{
			kind: 'menu',
			icon: IconTypography,
			label: 'Text style',
			items: [
				{ label: 'Emphasis', hint: '\\emph{}', run: w('\\emph{', '}') },
				{ label: 'Small caps', hint: '\\textsc{}', run: w('\\textsc{', '}') },
				{ label: 'Monospace', hint: '\\texttt{}', run: w('\\texttt{', '}') },
				{ label: 'Sans serif', hint: '\\textsf{}', run: w('\\textsf{', '}') },
				{ label: 'Strikethrough', hint: '\\sout{}', run: w('\\sout{', '}') },
				'sep',
				{ label: 'Superscript', hint: '\\textsuperscript{}', run: w('\\textsuperscript{', '}') },
				{ label: 'Subscript', hint: '\\textsubscript{}', run: w('\\textsubscript{', '}') }
			]
		},
		{
			kind: 'menu',
			icon: IconHeading,
			label: 'Heading',
			items: [
				{ label: 'Part', hint: '\\part{}', run: w('\\part{', '}') },
				{ label: 'Chapter', hint: '\\chapter{}', run: w('\\chapter{', '}') },
				{ label: 'Section', hint: '\\section{}', run: w('\\section{', '}') },
				{ label: 'Subsection', hint: '\\subsection{}', run: w('\\subsection{', '}') },
				{ label: 'Subsubsection', hint: '\\subsubsection{}', run: w('\\subsubsection{', '}') },
				{ label: 'Paragraph', hint: '\\paragraph{}', run: w('\\paragraph{', '}') },
				{ label: 'Subparagraph', hint: '\\subparagraph{}', run: w('\\subparagraph{', '}') }
			]
		},
		{
			kind: 'menu',
			icon: IconList,
			label: 'List',
			items: [
				{
					label: 'Bulleted list',
					hint: 'itemize',
					run: t('itemize')
				},
				{
					label: 'Numbered list',
					hint: 'enumerate',
					run: t('enumerate')
				},
				{
					label: 'Description list',
					hint: 'description',
					run: t('description')
				}
			]
		},
		{
			kind: 'group',
			actions: [
				{ icon: IconMath, label: 'Inline math', run: w('$', '$') },
				{ icon: IconMathFunction, label: 'Display math', run: w('\\[\n  ', '\n\\]') }
			]
		},
		{
			kind: 'menu',
			icon: IconMathSymbols,
			label: 'Math',
			items: [
				{
					label: 'Equation',
					hint: 'equation',
					run: t('equation')
				},
				{
					label: 'Aligned',
					hint: 'align',
					run: t('align')
				},
				'sep',
				{ label: 'Fraction', hint: '\\frac{}{}', run: w('\\frac{', '}{}') },
				{ label: 'Square root', hint: '\\sqrt{}', run: w('\\sqrt{', '}') },
				{ label: 'Summation', hint: '\\sum', run: i('\\sum_{i=1}^{n} ') },
				{ label: 'Product', hint: '\\prod', run: i('\\prod_{i=1}^{n} ') },
				{ label: 'Integral', hint: '\\int', run: i('\\int_{a}^{b} ') },
				{ label: 'Limit', hint: '\\lim', run: i('\\lim_{x \\to 0} ') },
				'sep',
				{ label: 'Matrix', hint: 'pmatrix', run: t('matrix') },
				{ label: 'Cases', hint: 'cases', run: t('cases') }
			]
		},
		{
			kind: 'menu',
			icon: IconPlus,
			label: 'Insert',
			items: [
				{ label: 'Link', hint: '\\href{}{}', run: w('\\href{https://example.com}{', '}') },
				{ label: 'Footnote', hint: '\\footnote{}', run: w('\\footnote{', '}') },
				{ label: 'Citation', hint: '\\cite{}', run: w('\\cite{', '}') },
				{ label: 'Cross-reference', hint: '\\ref{}', run: w('\\ref{', '}') },
				{ label: 'Label', hint: '\\label{}', run: w('\\label{', '}') },
				'sep',
				{
					label: 'Sample paragraph',
					hint: 'text',
					run: t('sample')
				},
				{
					label: 'Figure',
					hint: 'figure',
					// example-image ships with the mwe package: a real placeholder graphic
					// so the inserted figure renders immediately. Swap for your own file.
					run: t('figure')
				},
				{
					label: 'Table',
					hint: 'tabular',
					run: t('table')
				},
				{
					label: 'Code block',
					hint: 'verbatim',
					run: t('verbatim')
				},
				{
					label: 'Block quote',
					hint: 'quote',
					run: t('quote')
				}
			]
		}
	];

	const isSep = (x: Cmd | 'sep'): x is 'sep' => x === 'sep';
</script>

<!-- Ghost throughout: bordered chips here read as a second, competing toolbar next
     to the pane's own ghost controls. Clusters are separated by hairlines. -->
<div class="flex items-center gap-0.5" role="toolbar" aria-label="Formatting">
	{#each clusters as cluster, ci (ci)}
		{#if ci > 0}
			<span class="bg-border/60 mx-1 h-5 w-px shrink-0" aria-hidden="true"></span>
		{/if}
		{#if cluster.kind === 'group'}
			<div class="flex shrink-0 items-center gap-0.5">
				{#each cluster.actions as a (a.label)}
					{@const Icon = a.icon}
					<Button
						variant="ghost"
						size="icon-sm"
						title={a.label}
						aria-label={a.label}
						onclick={a.run}
						onmousedown={(e: MouseEvent) => e.preventDefault()}
					>
						<Icon class="size-4" />
					</Button>
				{/each}
			</div>
		{:else}
			{@const Icon = cluster.icon}
			<DropdownMenu>
				<DropdownMenuTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="sm"
							class="shrink-0 gap-0.5 px-1.5"
							title={cluster.label}
							aria-label={cluster.label}
						>
							<Icon class="size-4" />
							<IconChevronDown class="size-3 opacity-50" />
						</Button>
					{/snippet}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" class="w-56" onCloseAutoFocus={onMenuClose}>
					{#each cluster.items as item, ii (ii)}
						{#if isSep(item)}
							<DropdownMenuSeparator />
						{:else}
							<DropdownMenuItem onSelect={runItem(item)}>
								<span class="flex-1">{item.label}</span>
								{#if item.hint}<DropdownMenuShortcut class="font-mono"
										>{item.hint}</DropdownMenuShortcut
									>{/if}
							</DropdownMenuItem>
						{/if}
					{/each}
				</DropdownMenuContent>
			</DropdownMenu>
		{/if}
	{/each}
</div>
