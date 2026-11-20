import type { PackageSpec } from "../types";

/** ulem and soul: underline and strike variants that print back as written. */
export const ulem: PackageSpec = {
	package: "ulem",
	marks: {
		uline: "underline",
		uwave: "underline",
		dashuline: "underline",
		dotuline: "underline",
		sout: "strike",
		xout: "strike"
	}
};

export const soul: PackageSpec = {
	package: "soul",
	marks: { ul: "underline", st: "strike" }
};

export const paralist: PackageSpec = {
	package: "paralist",
	lists: {
		compactitem: {},
		compactenum: { ordered: true },
		compactdesc: { description: true },
		asparaitem: {},
		asparaenum: { ordered: true },
		asparadesc: { description: true }
	}
};

export const listings: PackageSpec = {
	package: "listings",
	code: [
		"lstlisting",
		"minted",
		"Verbatim",
		"Verbatim*",
		"BVerbatim",
		"LVerbatim",
		"alltt",
		"comment",
		"spverbatim",
		"tcblisting"
	]
};

export const floatExtras: PackageSpec = {
	package: "",
	floats: [
		"wrapfigure",
		"wraptable",
		"sidewaysfigure",
		"sidewaystable",
		"sidewaysfigure*",
		"sidewaystable*",
		"algorithm",
		"algorithm*",
		"listing",
		"SCfigure",
		"floatingfigure"
	]
};

export const csquotes: PackageSpec = {
	package: "csquotes",
	quotes: ["displayquote", "quoting"]
};
