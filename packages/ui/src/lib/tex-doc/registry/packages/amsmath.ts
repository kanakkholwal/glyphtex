import type { PackageSpec } from "../types";
import { withStar } from "../types";

export const amsmath: PackageSpec = {
	package: "amsmath",
	refs: ["eqref"],
	math: withStar(["align", "alignat", "xalignat", "xxalignat", "gather", "multline", "flalign"])
};

/** breqn, empheq and IEEEtrantools: display math that is not amsmath's. */
export const mathExtras: PackageSpec = {
	package: "",
	math: [
		"dmath",
		"dmath*",
		"dgroup",
		"dgroup*",
		"dseries",
		"dseries*",
		"empheq",
		"IEEEeqnarray",
		"IEEEeqnarray*"
	]
};
