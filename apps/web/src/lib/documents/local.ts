import {
	getProject,
	readFiles,
	renameProject,
	setEntry,
	writeFiles,
	type StoredProject
} from "$lib/storage/projects";
import type { DocumentMeta, DocumentStore } from "./store";

const toMeta = (p: StoredProject): DocumentMeta => ({
	id: p.id,
	name: p.name,
	entry: p.entry,
	entryConfirmed: p.entryConfirmed,
	entryCandidates: p.entryCandidates
});

export const localStore: DocumentStore = {
	kind: "local",
	async load(id) {
		// Independent reads: a missing id just yields no files.
		const [found, files] = await Promise.all([getProject(id), readFiles(id)]);
		if (!found) return undefined;
		return {
			meta: toMeta(found),
			files: files.map((f) => ({ path: f.path, text: f.text, data: f.data }))
		};
	},
	async save(id, files) {
		await writeFiles(id, files);
	},
	rename: async (id, name) => toMeta(await renameProject(id, name)),
	setEntry: async (id, path) => toMeta(await setEntry(id, path))
};
