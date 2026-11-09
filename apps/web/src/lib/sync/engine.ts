import { CloudError, cloud, type FileMeta } from "$lib/cloud/api";
import {
	createProject,
	getProject,
	type NewFile,
	readFiles,
	type RemoteLink,
	setEntry,
	setRemote,
	type StoredProject,
	writeFiles
} from "$lib/storage/projects";
import { writeZip } from "$lib/storage/zip";

export type SyncResult = {
	pushed: number;
	pulled: number;
	conflicts: string[];
	unsynced: string[];
};

const encoder = new TextEncoder();
const bytesOf = (f: NewFile) => f.data ?? encoder.encode(f.text ?? "");

async function sha256Hex(bytes: Uint8Array) {
	const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const canPush = (role: string) => role === "owner" || role === "editor";

let storesFiles: Promise<boolean> | undefined;
/** Whether the server keeps binary files; unknown counts as yes, so a failed lookup never hides images. */
const serverStoresFiles = () =>
	(storesFiles ??= cloud
		.config()
		.then((c) => c.features.blobs)
		.catch(() => {
			storesFiles = undefined;
			return true;
		}));

/** `chapter.tex` -> `chapter (server copy).tex`: where the other side's version lands on a conflict. */
export function conflictPath(path: string) {
	const slash = path.lastIndexOf("/") + 1;
	const dot = path.lastIndexOf(".");
	return dot > slash
		? `${path.slice(0, dot)} (server copy)${path.slice(dot)}`
		: `${path} (server copy)`;
}

async function remoteFiles(remoteId: string) {
	const metas = await cloud.files.list(remoteId);
	const files = await Promise.all(
		metas.map(
			async (m): Promise<NewFile & { meta: FileMeta }> =>
				m.kind === "text"
					? { path: m.path, text: m.content ?? "", meta: m }
					: { path: m.path, data: await cloud.files.bytes(remoteId, m.path), meta: m }
		)
	);
	return files;
}

const baseOf = (metas: FileMeta[]) =>
	Object.fromEntries(metas.map((m) => [m.path, { version: m.version, sha256: m.sha256 }]));

/** Copies a browser document to the server and links the two. Org projects go to `orgId`. */
export async function linkProject(
	localId: string,
	orgId: string | null = null
): Promise<RemoteLink> {
	const [project, files] = await Promise.all([getProject(localId), readFiles(localId)]);
	if (!project) throw new Error("That document no longer exists.");
	if (project.remote) return project.remote;
	const zip = await writeZip(files.map((f) => ({ path: f.path, data: bytesOf(f) })));
	const result = await cloud.projects.import(project.name, zip, orgId ?? undefined);
	if (result.project.mainFile !== project.entry && files.some((f) => f.path === project.entry)) {
		await cloud.projects.update(result.project.id, { mainFile: project.entry });
	}
	const onServer = await cloud.files.list(result.project.id);
	const stored = new Set(onServer.map((m) => m.path));
	const remote: RemoteLink = {
		id: result.project.id,
		orgId,
		role: "owner",
		syncedAt: Date.now(),
		base: baseOf(onServer),
		unsynced: files.filter((f) => f.data && !stored.has(f.path)).map((f) => f.path)
	};
	await setRemote(localId, remote);
	return remote;
}

/** Opens a server project in this browser: reuses the linked copy, or makes one. */
export async function cloneRemote(remoteId: string, existing?: StoredProject): Promise<string> {
	if (existing) {
		await syncProject(existing.id);
		return existing.id;
	}
	const view = await cloud.projects.get(remoteId);
	const files = await remoteFiles(remoteId);
	const created = await createProject(
		view.name,
		files.map(({ meta: _, ...f }) => f)
	);
	if (created.entry !== view.mainFile && files.some((f) => f.path === view.mainFile)) {
		await setEntry(created.id, view.mainFile);
	}
	await setRemote(created.id, {
		id: remoteId,
		orgId: view.organizationId,
		role: view.role,
		syncedAt: Date.now(),
		base: baseOf(files.map((f) => f.meta))
	});
	return created.id;
}

/**
 * Two-way sync against the last agreed state (`base`). A side that changed wins; when both
 * changed, the browser keeps its text and the server version lands beside it as a copy.
 */
export async function syncProject(localId: string): Promise<SyncResult> {
	const project = await getProject(localId);
	const link = project?.remote;
	if (!project || !link) return { pushed: 0, pulled: 0, conflicts: [], unsynced: [] };

	const view = await cloud.projects.get(link.id).catch((e: unknown) => {
		if (e instanceof CloudError && e.status === 404) {
			throw new CloudError(
				404,
				"not_found",
				"The server copy is gone or no longer shared with you."
			);
		}
		throw e;
	});
	const [local, server] = await Promise.all([readFiles(localId), remoteFiles(link.id)]);
	const localBy = new Map(local.map((f) => [f.path, { path: f.path, text: f.text, data: f.data }]));
	const serverBy = new Map(server.map((f) => [f.path, f]));
	const base = { ...link.base };
	const conflicts = new Set(link.conflicts ?? []);
	const unsynced = new Set(link.unsynced ?? []);
	const blobsOn = await serverStoresFiles();
	const localSha = new Map<string, string>();
	for (const [path, f] of localBy) localSha.set(path, await sha256Hex(bytesOf(f)));

	let pulled = 0;
	let dirty = false;
	const next = new Map(localBy);
	const toPush: string[] = [];
	const toDelete: { path: string; version: number }[] = [];

	for (const path of new Set([...localBy.keys(), ...serverBy.keys(), ...Object.keys(base)])) {
		// Without server file storage an image never leaves this browser, so there is nothing to compare.
		if (!blobsOn && localBy.get(path)?.data) {
			unsynced.add(path);
			continue;
		}
		const b = base[path];
		const s = serverBy.get(path);
		const lSha = localSha.get(path);
		const localChanged = b ? lSha !== b.sha256 : lSha !== undefined;
		const serverChanged = b ? s?.meta.version !== b.version : s !== undefined;

		if (!serverChanged && !localChanged) continue;
		if (serverChanged && !localChanged) {
			// Take the server's side: a new or edited file, or a deletion.
			if (s) next.set(path, { path, text: s.text, data: s.data });
			else next.delete(path);
			if (s) base[path] = { version: s.meta.version, sha256: s.meta.sha256 };
			else delete base[path];
			pulled++;
			dirty = true;
			continue;
		}
		if (localChanged && !serverChanged) {
			if (lSha === undefined && b) toDelete.push({ path, version: b.version });
			else toPush.push(path);
			continue;
		}
		// Both sides moved. Identical content is not a conflict.
		if (s && lSha === s.meta.sha256) {
			base[path] = { version: s.meta.version, sha256: s.meta.sha256 };
			continue;
		}
		if (s) {
			next.set(conflictPath(path), { path: conflictPath(path), text: s.text, data: s.data });
			conflicts.add(path);
			dirty = true;
			// The browser copy now builds on the server's version, so the next push succeeds.
			base[path] = { version: s.meta.version, sha256: s.meta.sha256 };
			if (lSha !== undefined) toPush.push(path);
			toPush.push(conflictPath(path));
		} else if (lSha !== undefined) {
			// Deleted on the server, edited here: the edit survives and is re-created.
			delete base[path];
			toPush.push(path);
		}
	}

	if (dirty) {
		await writeFiles(localId, [...next.values()]);
	}

	let pushed = 0;
	const role = view.role;
	if (canPush(role)) {
		for (const path of toPush) {
			const f = next.get(path);
			if (!f) continue;
			const b = base[path];
			try {
				const meta = await cloud.files.put(
					link.id,
					path,
					f.data ?? f.text ?? "",
					b ? { version: b.version } : { create: true }
				);
				base[path] = { version: meta.version, sha256: meta.sha256 };
				unsynced.delete(path);
				pushed++;
			} catch (e) {
				// Someone pushed between our read and write; the next sync reconciles it.
				if (e instanceof CloudError && e.conflict) continue;
				if (e instanceof CloudError && e.code === "storage_disabled") {
					unsynced.add(path);
					continue;
				}
				throw e;
			}
		}
		for (const d of toDelete) {
			try {
				await cloud.files.remove(link.id, d.path, d.version);
				delete base[d.path];
				pushed++;
			} catch (e) {
				if (e instanceof CloudError && e.status === 404) delete base[d.path];
				else if (!(e instanceof CloudError && e.conflict)) throw e;
			}
		}
	}

	// Resolved once the user deletes the server copy.
	for (const path of conflicts) if (!next.has(conflictPath(path))) conflicts.delete(path);

	await setRemote(localId, {
		...link,
		role,
		orgId: view.organizationId,
		syncedAt: Date.now(),
		base,
		conflicts: [...conflicts],
		unsynced: [...unsynced].filter((p) => next.has(p))
	});
	return {
		pushed,
		pulled,
		conflicts: [...conflicts],
		unsynced: [...unsynced].filter((p) => next.has(p))
	};
}

/** Whether the browser copy has edits the server hasn't seen (cheap: no network). */
export async function hasLocalChanges(localId: string): Promise<boolean> {
	const project = await getProject(localId);
	if (!project?.remote) return false;
	const files = await readFiles(localId);
	const base = project.remote.base;
	const kept = new Set(project.remote.unsynced ?? []);
	const tracked = files.filter((f) => !kept.has(f.path));
	if (tracked.length !== Object.keys(base).length) return true;
	for (const f of tracked) {
		if (base[f.path]?.sha256 !== (await sha256Hex(bytesOf(f)))) return true;
	}
	return false;
}
