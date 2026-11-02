import { REPO_URL } from "$lib/landing/nav-data";

/** Target turnaround for a package request, stated wherever we ask people to file one. */
export const REQUEST_ETA = "about a week";

/** A prefilled GitHub issue in the same shape as the editor's "Package support" report. */
export function packageRequestUrl(name?: string): string {
	const body = [
		"### Package or class",
		"",
		name ? `- \`${name}\`` : "- ",
		"",
		"### What you use it for",
		"",
		"<!-- A thesis template, a journal class, slides… -->",
		"",
		"### How your document loads it",
		"",
		"```tex",
		name ? `\\usepackage{${name}}` : "\\usepackage{...}",
		"```"
	].join("\n");
	const params = new URLSearchParams({
		title: `Package support: ${name ?? ""}`.trim(),
		body,
		labels: "package-support"
	});
	return `${REPO_URL}/issues/new?${params.toString()}`;
}
