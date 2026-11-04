import { CloudError, cloud, type FileMeta, type ProjectView } from "$lib/cloud/api";
import type { NewFile } from "$lib/storage/projects";
import type { DocumentMeta, DocumentStore } from "./store";

type Synced = { version: number; text?: string; sha256: string };

const toMeta = (
	p: Pick<ProjectView, "id" | "name" | "mainFile"> & Partial<ProjectView>
): DocumentMeta => ({
	id: p.id,
	name: p.name,
	entry: p.mainFile,
	// The server already chose the root on import, so there's nothing to ask.
	entryConfirmed: true,
	entryCandidates: [],
	// Updates return the bare project; callers merge, so absent fields must stay absent.
	...(p.capabilities && { capabilities: p.capabilities }),
	...(p.role && { role: p.role })
});

async function sha256Hex(bytes: Uint8Array) {
	const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
	let next = 0;
	const worker = async () => {
		while (next < items.length) await fn(items[next++] as T);
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Server-backed documents. Saves send only what changed since the last sync, each with
 * the version it was based on, so a collaborator's newer edit surfaces as a conflict.
 */
export function createCloudStore(): DocumentStore {
	const synced = new Map<string, Map<string, Synced>>();

	const record = (docId: string, meta: FileMeta, text?: string) =>
		synced.get(docId)?.set(meta.path, { version: meta.version, sha256: meta.sha256, text });

	return {
		kind: "cloud",

		async load(id) {
			let project: ProjectView;
			try {
				project = await cloud.projects.get(id);
			} catch (error) {
				if (error instanceof CloudError && error.status === 404) return undefined;
				throw error;
			}
			const metas = await cloud.files.list(id);
			const files = await Promise.all(
				metas.map(
					async (m): Promise<NewFile> =>
						m.kind === "text"
							? { path: m.path, text: m.content ?? "" }
							: { path: m.path, data: await cloud.files.bytes(id, m.path) }
				)
			);
			synced.set(
				id,
				new Map(
					metas.map((m) => [
						m.path,
						{
							version: m.version,
							sha256: m.sha256,
							text: m.kind === "text" ? (m.content ?? "") : undefined
						}
					])
				)
			);
			return { meta: toMeta(project), files };
		},

		async save(id, files) {
			const known = synced.get(id);
			if (!known) throw new Error("This document isn't loaded.");
			const wanted = new Set(files.map((f) => f.path));
			const conflicts: string[] = [];

			const changed: NewFile[] = [];
			for (const f of files) {
				const prev = known.get(f.path);
				if (!prev) changed.push(f);
				else if (f.data) {
					if ((await sha256Hex(f.data)) !== prev.sha256) changed.push(f);
				} else if ((f.text ?? "") !== prev.text) changed.push(f);
			}

			await mapLimit(changed, 4, async (f) => {
				const prev = known.get(f.path);
				const body = f.data ?? f.text ?? "";
				try {
					const meta = await cloud.files.put(
						id,
						f.path,
						body,
						prev ? { version: prev.version } : { create: true }
					);
					record(id, meta, f.data ? undefined : (f.text ?? ""));
				} catch (error) {
					if (error instanceof CloudError && error.conflict) conflicts.push(f.path);
					else throw error;
				}
			});

			const removed = [...known.keys()].filter((path) => !wanted.has(path));
			await mapLimit(removed, 4, async (path) => {
				const prev = known.get(path);
				if (!prev) return;
				try {
					await cloud.files.remove(id, path, prev.version);
					known.delete(path);
				} catch (error) {
					// Already gone is the outcome we wanted.
					if (error instanceof CloudError && error.status === 404) known.delete(path);
					else if (error instanceof CloudError && error.conflict) conflicts.push(path);
					else throw error;
				}
			});

			if (conflicts.length) {
				throw new CloudError(
					409,
					"conflict",
					conflicts.length === 1
						? `${conflicts[0]} was changed by someone else. Reload to get their version.`
						: `${conflicts.length} files were changed by someone else. Reload to get their versions.`
				);
			}
		},

		rename: async (id, name) => toMeta((await cloud.projects.update(id, { name })).project),
		setEntry: async (id, path) =>
			toMeta((await cloud.projects.update(id, { mainFile: path })).project)
	};
}
