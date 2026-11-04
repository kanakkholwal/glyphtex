import { cloud } from "$lib/cloud/api";
import {
	getProject,
	readFiles,
	renameProject,
	setEntry,
	type StoredProject,
	writeFiles
} from "$lib/storage/projects";
import { sync } from "$lib/sync/sync.svelte";
import type { DocumentMeta, DocumentStore } from "./store";

const toMeta = (p: StoredProject): DocumentMeta => ({
	id: p.id,
	name: p.name,
	entry: p.entry,
	entryConfirmed: p.entryConfirmed,
	entryCandidates: p.entryCandidates,
	...(p.remote && { remoteId: p.remote.id, role: p.remote.role, conflicts: p.remote.conflicts })
});

const canWrite = (p: StoredProject) => !p.remote || ["owner", "editor"].includes(p.remote.role);

/** Mirrors a name or main-file change to the server copy; the next sync would not carry it. */
async function mirror(p: StoredProject, patch: { name?: string; mainFile?: string }) {
	if (!p.remote || !canWrite(p)) return;
	await cloud.projects.update(p.remote.id, patch).catch(() => {
		// Best effort: the browser copy is the source; a failed mirror is retried by the next rename.
	});
}

/** Every document lives in this browser; a linked one also syncs with its server copy. */
export const localStore: DocumentStore = {
	kind: "local",
	async load(id) {
		const linked = (await getProject(id))?.remote;
		// Pull before opening, in both sync modes, so a shared project shows the latest edits.
		// Offline or a server error still opens the browser copy.
		if (linked) await sync.run(id).catch(() => {});
		const [found, files] = await Promise.all([getProject(id), readFiles(id)]);
		if (!found) return undefined;
		return {
			meta: toMeta(found),
			files: files.map((f) => ({ path: f.path, text: f.text, data: f.data }))
		};
	},
	async save(id, files) {
		await writeFiles(id, files);
		sync.saved(id, Boolean((await getProject(id))?.remote));
	},
	async rename(id, name) {
		const next = await renameProject(id, name);
		await mirror(next, { name: next.name });
		return toMeta(next);
	},
	async setEntry(id, path) {
		const next = await setEntry(id, path);
		await mirror(next, { mainFile: next.entry });
		return toMeta(next);
	}
};
