import type { PackageData } from "./index";

// Incompatible with `subfig` and the obsolete `subfigure`.
export const data: PackageData = {
	commands: [
		{
			name: "subcaption",
			snippet: "subcaption{$1}$0",
			detail: "Caption for a sub-figure without the surrounding box",
			doc: "Inside a `subfigure` environment `\\caption` is usually what you want; this is the explicit spelling for the rare case where both a caption and a sub-caption appear.",
			package: "subcaption",
			context: "text",
		},
		{
			name: "subcaptionbox",
			snippet: "subcaptionbox{${1:Caption}}{$2}$0",
			detail: "Sub-figure as a single command rather than an environment",
			doc: "Sizes itself to the content instead of a fixed width, so a row of images with unequal widths still aligns. Width and alignment are optional: `\\subcaptionbox{Cap}[0.4\\textwidth]{…}`.",
			example: "\\subcaptionbox{Left\\label{fig:a}}{\\includegraphics[width=0.4\\textwidth]{a}}",
			package: "subcaption",
			context: "text",
		},
		{
			name: "subref",
			snippet: "subref{$1}$0",
			detail: "Reference a sub-figure by its sub-number alone",
			doc: "“(a)” rather than “1a”. `\\subref*{…}` gives the bare letter with no parentheses.",
			example: "compare \\subref{fig:left} with \\subref{fig:right}",
			package: "subcaption",
			context: "text",
		},
		{
			name: "subref*",
			snippet: "subref*{$1}$0",
			detail: "Sub-figure letter with no parentheses",
			package: "subcaption",
			context: "text",
		},
		{
			name: "phantomcaption",
			detail: "Step the sub-counter without printing a caption",
			doc: "Lets a `\\label` attach to a sub-float that has no visible caption — the usual trick for a shared caption covering several images.",
			example: "\\phantomcaption\\label{fig:left}",
			package: "subcaption",
			context: "text",
		},
		{
			name: "phantomsubcaption",
			detail: "Sub-counter step with no caption (explicit spelling)",
			package: "subcaption",
			context: "text",
		},
		{
			name: "captionsetup",
			snippet: "captionsetup[${1:sub}]{$2}$0",
			detail: "Configure captions, optionally only sub-captions",
			doc: "`[subfigure]` or `[sub]` scopes the settings to sub-captions: `\\captionsetup[sub]{labelformat=parens, font=small}`.",
			example: "\\captionsetup[sub]{labelformat=parens, labelsep=space}",
			package: "subcaption",
		},
		{
			name: "DeclareCaptionSubType",
			snippet: "DeclareCaptionSubType{${1:figure}}$0",
			detail: "Enable sub-captions for a float type",
			doc: "The optional argument sets the numbering: `\\DeclareCaptionSubType[alph]{table}` gives (a), (b), …",
			example: "\\DeclareCaptionSubType[alph]{table}",
			package: "subcaption",
		},
		{
			name: "thesubfigure",
			detail: "How a sub-figure number is printed",
			doc: "`\\renewcommand{\\thesubfigure}{\\roman{subfigure}}` for lowercase roman sub-numbers.",
			package: "subcaption",
		},
		{
			name: "thesubtable",
			detail: "How a sub-table number is printed",
			package: "subcaption",
		},
		{
			name: "subfigurename",
			detail: "The word used for a sub-figure in cross-references",
			package: "subcaption",
		},
	],
	environments: [
		{
			name: "subfigure",
			detail: "Sub-figure of a given width, inside a figure",
			body: "{${1:0.48\\textwidth}}\n\t\\centering\n\t$0\n\t\\caption{}\n\t\\label{fig:}\n",
			package: "subcaption",
			context: "text",
		},
		{
			name: "subtable",
			detail: "Sub-table of a given width, inside a table",
			body: "{${1:0.48\\textwidth}}\n\t\\centering\n\t$0\n\t\\caption{}\n\t\\label{tab:}\n",
			package: "subcaption",
			context: "text",
		},
		{
			name: "subcaptionblock",
			detail: "Sub-float box, type-neutral (newer name for subfigure)",
			body: "{${1:0.48\\textwidth}}\n\t\\centering\n\t$0\n\t\\caption{}\n",
			package: "subcaption",
			context: "text",
		},
	],
};
