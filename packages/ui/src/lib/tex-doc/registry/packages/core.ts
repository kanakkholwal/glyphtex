import type { PackageSpec } from "../types";
import { withStar } from "../types";

export const core: PackageSpec = {
	package: "",
	marks: {
		textbf: "bold",
		bfseries: "bold",
		textit: "italic",
		textsl: "italic",
		emph: "emph",
		texttt: "code",
		textsc: "smallcaps",
		textsf: "sans",
		underline: "underline",
		textsuperscript: "superscript",
		textsubscript: "subscript"
	},
	refs: ["ref", "pageref"],
	cites: ["cite", "nocite"],
	lists: { itemize: {}, enumerate: { ordered: true }, description: { description: true } },
	math: withStar(["equation", "eqnarray"]).concat("displaymath"),
	code: ["verbatim", "verbatim*"],
	floats: withStar(["figure", "table"]),
	quotes: ["quote", "quotation", "verse"]
};
