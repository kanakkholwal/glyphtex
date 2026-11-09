import type { CompileFile } from "$lib/compile";
import { cloud, type OrgLibrary } from "./api";

const TTL_MS = 5 * 60_000;
const listings = new Map<string, { at: number; library: Promise<OrgLibrary> }>();
const binaries = new Map<string, Promise<Uint8Array>>();

function listing(orgId: string) {
	const hit = listings.get(orgId);
	if (hit && Date.now() - hit.at < TTL_MS) return hit.library;
	const library = cloud.orgs.library(orgId);
	listings.set(orgId, { at: Date.now(), library });
	library.catch(() => listings.delete(orgId));
	return library;
}

function binary(orgId: string, path: string, sha256: string) {
	let data = binaries.get(sha256);
	if (!data) {
		data = cloud.orgs.libraryBytes(orgId, path);
		binaries.set(sha256, data);
		data.catch(() => binaries.delete(sha256));
	}
	return data;
}

/** Adds the org's shared packages to a compile; the document's own files win on a clash. */
export async function withOrgLibrary(files: CompileFile[], orgId: string | undefined) {
	if (!orgId) return files;
	try {
		const own = new Set(files.map((f) => f.name));
		const { files: shared } = await listing(orgId);
		const extra = await Promise.all(
			shared
				.filter((f) => !own.has(f.path))
				.map(
					async (f): Promise<CompileFile> =>
						f.kind === "text"
							? { name: f.path, text: f.content ?? "" }
							: { name: f.path, data: await binary(orgId, f.path, f.sha256) }
				)
		);
		return [...files, ...extra];
	} catch (error) {
		// Offline or signed out: compile without it; a package it held shows up as missing.
		console.warn("Couldn't load the organization's shared packages", error);
		return files;
	}
}

/** Drops the cached listing so the next compile sees an edited library. */
export const forgetOrgLibrary = (orgId: string) => listings.delete(orgId);
