/**
 * Builds the body of a package-support issue.
 *
 * Privacy model: **allowlist, never blacklist.** Only declarations we can name
 * in advance are copied out of the document — the class line and the package
 * requests that caused the failure. Everything else (prose, data, maths, file
 * names, comments) is never read, so there is nothing to strip and nothing to
 * get wrong. The caller shows the finished text before anything is sent.
 */

/** Preamble commands that are safe to quote: each names a package, not content. */
const DECLARATIONS =
	/^\s*\\(documentclass|usepackage|RequirePackage|LoadClass|usetikzlibrary|usepgfplotslibrary)\b[^\n]*/gm;

/** Stop at `\begin{document}` — nothing after it is a declaration. */
export function preambleDeclarations(source: string, limit = 40): string[] {
	const preamble = source.split(/\\begin\s*\{document\}/)[0] ?? '';
	const found = preamble.match(DECLARATIONS) ?? [];
	// A trailing `%` comment on a declaration line can hold anything.
	return found.map((line) => line.replace(/(?<!\\)%.*$/, '').trimEnd()).slice(0, limit);
}

export type SupportReport = {
	/** Files the engine could not resolve — the subject of the report. */
	unsupportedFiles: string[];
	/** Full text of the document's main file. Only its declarations are read. */
	mainSource?: string;
	/** How many files the project has. A count, not a listing. */
	fileCount?: number;
	engine?: string;
	appVersion?: string;
};

function environment(report: SupportReport): string[] {
	const lines = [`- Engine: ${report.engine ?? 'on-device (Tectonic/WASM)'}`, `- Build: web`];
	if (report.appVersion) lines.push(`- Version: ${report.appVersion}`);
	if (typeof navigator !== 'undefined') lines.push(`- Browser: ${navigator.userAgent}`);
	if (report.fileCount) lines.push(`- Document: ${report.fileCount} files`);
	return lines;
}

export function buildSupportBody(report: SupportReport): string {
	const declarations = preambleDeclarations(report.mainSource ?? '');
	const out = [
		'### Files the engine could not resolve',
		'',
		...report.unsupportedFiles.map((f) => `- \`${f}\``),
		''
	];

	if (declarations.length) {
		out.push('### Declarations that requested them', '', '```tex', ...declarations, '```', '');
	}

	out.push(
		'### Environment',
		'',
		...environment(report),
		'',
		'---',
		'',
		'_Only the class and package declarations above were copied from the document._',
		'_No prose, data, maths, file names or comments are included._',
		'',
		'<!-- Anything else that would help? -->'
	);
	return out.join('\n');
}

export function supportIssueUrl(repoUrl: string, report: SupportReport): string {
	const params = new URLSearchParams({
		title: `Package support: ${report.unsupportedFiles.join(', ')}`,
		body: buildSupportBody(report),
		labels: 'package-support'
	});
	return `${repoUrl}/issues/new?${params.toString()}`;
}
