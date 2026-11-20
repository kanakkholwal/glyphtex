import type { ContainerSpec, PackageSpec } from "../types";

const theorem = (label: string, numbered = true): ContainerSpec => ({
	role: "theorem",
	label,
	numbered
});

export const structure: PackageSpec = {
	package: "",
	containers: {
		abstract: { role: "abstract", label: "Abstract" },
		center: { role: "wrapper", label: "Centered" },
		flushleft: { role: "wrapper", label: "Left" },
		flushright: { role: "wrapper", label: "Right" },
		thebibliography: { role: "bibliography", label: "References" }
	}
};

/** amsthm's usual statements; `\newtheorem` in the preamble adds the rest. */
export const amsthm: PackageSpec = {
	package: "amsthm",
	containers: {
		proof: { role: "proof", label: "Proof" },
		theorem: theorem("Theorem"),
		lemma: theorem("Lemma"),
		proposition: theorem("Proposition"),
		corollary: theorem("Corollary"),
		conjecture: theorem("Conjecture"),
		claim: theorem("Claim"),
		fact: theorem("Fact"),
		definition: theorem("Definition"),
		example: theorem("Example"),
		remark: theorem("Remark"),
		note: theorem("Note"),
		notation: theorem("Notation"),
		problem: theorem("Problem"),
		exercise: theorem("Exercise"),
		question: theorem("Question"),
		assumption: theorem("Assumption"),
		observation: theorem("Observation")
	}
};
