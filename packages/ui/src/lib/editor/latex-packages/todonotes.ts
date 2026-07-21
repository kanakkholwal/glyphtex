import type { PackageData } from "./index";

// Load with `[disable]` to make every command a no-op for the final build.
export const data: PackageData = {
	commands: [
		{
			name: "todo",
			snippet: "todo{$1}$0",
			detail: "Margin note",
			doc: "Options go in brackets: `inline` (in the text flow rather than the margin), `color=`, `size=`, `noline`, `fancyline`, `author=`.",
			example: "\\todo{rewrite this paragraph}",
			package: "todonotes",
			context: "text",
		},
		{
			name: "missingfigure",
			snippet: "missingfigure{$1}$0",
			detail: "Placeholder box where a figure will go",
			doc: "Full-width grey box with the text inside, so a missing graphic is obvious in a draft.",
			example: "\\missingfigure{Architecture diagram of the compile pipeline}",
			package: "todonotes",
			context: "text",
		},
		{
			name: "listoftodos",
			snippet: "listoftodos$0",
			detail: "List of every note in the document",
			doc: "Optional argument retitles it: `\\listoftodos[Outstanding work]`.",
			example: "\\listoftodos[Outstanding work]",
			package: "todonotes",
			context: "text",
		},
		{
			name: "todototoc",
			detail: "Add the list of todos to the table of contents",
			doc: "Place it immediately before `\\listoftodos`.",
			example: "\\todototoc",
			package: "todonotes",
			context: "text",
		},
		{
			name: "todonotesset",
			snippet: "todonotesset{$1}$0",
			detail: "Set default options for every note",
			example: "\\todonotesset{color=yellow!40, size=\\small}",
			package: "todonotes",
		},
		{
			name: "presetkeys",
			snippet: "presetkeys{todonotes}{${1:inline}}{}$0",
			detail: "Preset todonotes keys via the xkeyval interface",
			package: "todonotes",
		},
		{
			name: "missingfigurename",
			detail: "Text printed inside a \\missingfigure box",
			doc: "`\\renewcommand{\\missingfigurename}{Figure pending}`.",
			package: "todonotes",
		},
		{
			name: "listtodoname",
			detail: "Default title of the list of todos",
			package: "todonotes",
		},
		{
			name: "todoname",
			detail: "The word used for a note in the list of todos",
			package: "todonotes",
		},
	],
	environments: [],
};
