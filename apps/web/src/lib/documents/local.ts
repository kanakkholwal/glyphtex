import { cloud } from "$lib/cloud/api";
import { cloudSession } from "$lib/cloud/session.svelte";
import {
	activeLink,
	getProject,
	readFiles,
	renameProject,
	setEntry,
	type StoredProject,
	writeFiles
} from "$lib/storage/projects";
import { sync } from "$lib/sync/sync.svelte";
import type { DocumentMeta, DocumentStore } from "./store";

/** Only the account that linked a copy treats it as cloud-backed; anyone else sees a browser document. */
const linkOf = (p: StoredProject) => activeLink(p, cloudSession.user?.id);

const toMeta = (p: StoredProject): DocumentMeta => {
	const link = linkOf(p);
	return {
		id: p.id,
		name: p.name,
		entry: p.entry,
		entryConfirmed: p.entryConfirmed,
		entryCandidates: p.entryCandidates,
		...(link && {
			remoteId: link.id,
			role: link.role,
			orgId: link.orgId ?? undefined,
			conflicts: link.conflicts
		})
	};
};

const canWrite = (p: StoredProject) => {
	const link = linkOf(p);
	return !link || ["owner", "editor"].includes(link.role);
};

/** Mirrors a name or main-file change to the server copy; the next sync would not carry it. */
async function mirror(p: StoredProject, patch: { name?: string; mainFile?: string }) {
	const link = linkOf(p);
	if (!link || !canWrite(p)) return;
	await cloud.projects.update(link.id, patch).catch(() => {
		// Best effort: the browser copy is the source; a failed mirror is retried by the next rename.
	});
}

/** Every document lives in this browser; a linked one also syncs with its server copy. */
export const localStore: DocumentStore = {
	kind: "local",
	async load(id) {
		await cloudSession.ensure();
		const found0 = await getProject(id);
		const linked = found0 && linkOf(found0);
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
		const current = await getProject(id);
		sync.saved(id, Boolean(current && linkOf(current)));
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
