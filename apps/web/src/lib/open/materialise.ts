import type { NewFile } from "$lib/storage/projects";
import { OPEN_LIMITS, type OpenRequest } from "./request";

export interface Materialised {
	name: string;
	files: NewFile[];
	entry: string;
}

/** Reads a remote body with a hard byte cap, so a hostile server can't stream the tab to death. */
async function download(url: string, max: number): Promise<Uint8Array> {
	// Anonymous and referrer-free: nothing about the visitor goes to the remote host.
	const res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
	if (!res.ok) throw new Error(`The remote file answered ${res.status}.`);
	const declared = Number(res.headers.get("content-length") ?? "0");
	if (declared > max) throw new Error("The remote file is too large.");
	const reader = res.body?.getReader();
	if (!reader) throw new Error("The remote file could not be read.");
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > max) {
			void reader.cancel();
			throw new Error("The remote file is too large.");
		}
		chunks.push(value);
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.byteLength;
	}
	return out;
}

function textFile(request: OpenRequest, text: string): Materialised {
	if (text.includes("\u0000")) throw new Error("That is not a text document.");
	return {
		name: request.name,
		entry: request.main,
		files: [{ path: request.main, text }]
	};
}

/** Turns a validated request into files, entirely in the browser. Nothing is compiled or executed. */
export async function materialise(request: OpenRequest): Promise<Materialised> {
	const { source } = request;
	if (source.kind === "snippet") return textFile(request, source.text);
	if (source.type === "tex") {
		const bytes = await download(source.url, OPEN_LIMITS.snippetChars);
		return textFile(request, new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	}
	const bytes = await download(source.url, OPEN_LIMITS.downloadBytes);
	const { importZipFile } = await import("$lib/storage/import");
	const result = await importZipFile(new File([bytes as BlobPart], `${request.name}.zip`));
	if (result.files.length === 0) throw new Error("Nothing in that archive could be imported.");
	return {
		name: request.name === "Imported" ? result.name : request.name,
		entry: request.main,
		files: result.files
	};
}
