/**
 * `enumitem` — key=value control over list layout.
 *
 * Replaces the ritual of redefining `\labelenumi` and poking at `\itemsep` with
 * a single option list, either per-list (`\begin{itemize}[nosep]`) or globally
 * (`\setlist`).
 *
 * The keys worth remembering: `label=` (e.g. `\alph*)`), `noitemsep` (kill the
 * space between items), `nosep` (kill it around the list too), `itemsep=`,
 * `parsep=`, `topsep=`, `leftmargin=`, `labelsep=`, `widest=`, `start=`,
 * `resume`, and `wide` for a list with no indentation at all.
 */
import type { PackageData } from "./index";

export const data: PackageData = {
	commands: [
		{
			name: "setlist",
			snippet: "setlist{${1:nosep}}$0",
			detail: "Set list options globally",
			doc: "The optional argument restricts the change to a list type and depth: `\\setlist[itemize]{…}`, `\\setlist[enumerate,2]{…}`. Without it, every list is affected.",
			example: "\\setlist{noitemsep, topsep=0pt, leftmargin=*}",
			package: "enumitem",
		},
		{
			name: "setlist*",
			snippet: "setlist*{$1}$0",
			detail: "Add to the current list options instead of replacing them",
			example: "\\setlist*[itemize,1]{label=\\textbullet}",
			package: "enumitem",
		},
		{
			name: "setlistdepth",
			snippet: "setlistdepth{${1:6}}$0",
			detail: "Raise the maximum list nesting depth",
			doc: "LaTeX allows four levels; this lifts the limit, but every level then needs a label defined for it.",
			example: "\\setlistdepth{9}",
			package: "enumitem",
		},
		{
			name: "newlist",
			snippet: "newlist{${1:steps}}{${2:enumerate}}{${3:3}}$0",
			detail: "Define a new list environment",
			doc: "Name, base type (`itemize`, `enumerate` or `description`) and maximum depth. Configure the result with `\\setlist[steps]{…}`.",
			example: "\\newlist{steps}{enumerate}{2}",
			package: "enumitem",
		},
		{
			name: "renewlist",
			snippet: "renewlist{${1:steps}}{${2:enumerate}}{${3:3}}$0",
			detail: "Redefine a list created with \\newlist",
			package: "enumitem",
		},
		{
			name: "restartlist",
			snippet: "restartlist{${1:enumerate}}$0",
			detail: "Reset a resumable list's counter",
			doc: "Pairs with the `resume` key — start counting from one again after a series of resumed lists.",
			example: "\\restartlist{enumerate}",
			package: "enumitem",
		},
		{
			name: "SetEnumitemKey",
			snippet: "SetEnumitemKey{${1:tight}}{${2:nosep}}$0",
			detail: "Define a shorthand key for a set of options",
			example: "\\SetEnumitemKey{tight}{topsep=0pt, itemsep=0pt}",
			package: "enumitem",
		},
		{
			name: "SetEnumitemValue",
			snippet: "SetEnumitemValue{${1:label}}{${2:name}}{${3:value}}$0",
			detail: "Define a named value for an enumitem key",
			package: "enumitem",
		},
		{
			name: "AddEnumerateCounter",
			snippet: "AddEnumerateCounter{${1:\\Alph}}{${2:\\@Alph}}{${3:M}}$0",
			detail: "Register a custom counter representation for labels",
			package: "enumitem",
		},
		{
			name: "labelindent",
			detail: "Indentation of the item label (enumitem length)",
			doc: "Set with `leftmargin=*` to make the margin follow the widest label: `\\setlist{leftmargin=*, labelindent=\\parindent}`.",
			package: "enumitem",
		},
		{
			name: "labelwidth",
			detail: "Width reserved for the item label",
			package: "enumitem",
		},
		{
			name: "labelsep",
			detail: "Space between the label and the item text",
			package: "enumitem",
		},
		{
			name: "itemsep",
			detail: "Vertical space between items",
			doc: "Usually set through an option — `itemsep=0pt` or simply `noitemsep` — rather than by hand.",
			package: "enumitem",
		},
		{
			name: "topsep",
			detail: "Vertical space above and below the list",
			package: "enumitem",
		},
	],
	environments: [
		{
			name: "enumerate*",
			detail: "Inline numbered list (requires the inline option)",
			body: "[label=(\\arabic*)]\n\t\\item $0\n",
			package: "enumitem",
			context: "text",
		},
		{
			name: "itemize*",
			detail: "Inline bulleted list (requires the inline option)",
			body: "\n\t\\item $0\n",
			package: "enumitem",
			context: "text",
		},
		{
			name: "description*",
			detail: "Inline labelled list (requires the inline option)",
			body: "\n\t\\item[${1:term}] $0\n",
			package: "enumitem",
			context: "text",
		},
	],
};
