import type { PackageData } from "./index";

export const data: PackageData = {
	commands: [
		{
			name: "geometry",
			snippet: "geometry{${1:a4paper, margin=2.5cm}}$0",
			detail: "Set the page geometry (preamble)",
			doc: "Equivalent to passing the same options to `\\usepackage`.\n\nPaper: `a4paper`, `letterpaper`, `paperwidth`, `paperheight`, `landscape`.\nMargins: `margin`, `hmargin`, `vmargin`, `left`, `right`, `top`, `bottom`, `inner`, `outer`.\nText block: `textwidth`, `textheight`, `lines`, `includehead`, `includefoot`, `heightrounded`.\nHeaders: `headheight`, `headsep`, `footskip`, `marginparwidth`, `marginparsep`.\nDebugging: `showframe` draws the layout boxes, which settles most margin arguments in one run.",
			example: "\\geometry{a4paper, left=3cm, right=2cm, top=2.5cm, bottom=2.5cm}",
			package: "geometry",
		},
		{
			name: "newgeometry",
			snippet: "newgeometry{${1:margin=1.5cm}}$0",
			detail: "Change the geometry from the next page onwards",
			doc: "Body only, and it starts a new page. Only margin-ish keys are allowed — paper size cannot change mid-document. Pair it with `\\restoregeometry`.",
			example: "\\newgeometry{margin=1.5cm}",
			package: "geometry",
			context: "text",
		},
		{
			name: "restoregeometry",
			detail: "Return to the geometry set in the preamble",
			doc: "Also starts a new page. Forgetting it is why a wide table sometimes takes the rest of the document with it.",
			example: "\\restoregeometry",
			package: "geometry",
			context: "text",
		},
		{
			name: "savegeometry",
			snippet: "savegeometry{${1:name}}$0",
			detail: "Save the current geometry under a name",
			doc: "Useful when a document alternates between two layouts more than once.",
			example: "\\savegeometry{wide}",
			package: "geometry",
			context: "text",
		},
		{
			name: "loadgeometry",
			snippet: "loadgeometry{${1:name}}$0",
			detail: "Restore a geometry saved with \\savegeometry",
			example: "\\loadgeometry{wide}",
			package: "geometry",
			context: "text",
		},
	],
	environments: [],
};
