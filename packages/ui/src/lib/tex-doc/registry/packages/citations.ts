import type { PackageSpec } from "../types";

export const natbib: PackageSpec = {
	package: "natbib",
	cites: [
		"citet",
		"citep",
		"citealt",
		"citealp",
		"citeauthor",
		"citeyear",
		"citeyearpar",
		"citenum",
		"Citet",
		"Citep",
		"Citealt",
		"Citealp",
		"Citeauthor"
	]
};

export const biblatex: PackageSpec = {
	package: "biblatex",
	cites: [
		"parencite",
		"textcite",
		"autocite",
		"smartcite",
		"footcite",
		"supercite",
		"fullcite",
		"citetitle",
		"citeurl",
		"citedate",
		"Cite",
		"Parencite",
		"Textcite",
		"Autocite",
		"Smartcite",
		"Footcite"
	]
};

export const cleveref: PackageSpec = {
	package: "cleveref",
	refs: ["cref", "Cref", "cpageref", "Cpageref", "labelcref", "namecref", "nameCref"]
};

export const crossRefs: PackageSpec = {
	package: "",
	refs: ["autoref", "nameref", "Nameref", "vref", "Vref", "vpageref", "subref"]
};
