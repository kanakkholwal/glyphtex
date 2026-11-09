import type { Deps } from "../context.ts";
import { newId, sha256Hex } from "../lib/crypto.ts";
import { isUniqueViolation } from "../lib/db-errors.ts";
import { errors } from "../lib/errors.ts";
import { isTextPath, normalizePath } from "../lib/paths.ts";
import type { ProjectAccess } from "../rbac/authorize.ts";
import { type FileRow, fileRepository } from "../repositories/files.ts";
import { projectRepository } from "../repositories/projects.ts";

/** HTTP preconditions: `If-None-Match: *` creates, `If-Match: "<version>"` updates. */
export type Precondition = { create: true } | { version: number };

export interface StoredContent {
	kind: "text" | "binary";
	content: string | null;
	blobKey: string | null;
	contentType: string | null;
	size: number;
	sha256: string;
}

const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

export const fileMeta = (f: FileRow) => ({
	path: f.path,
	kind: f.kind,
	size: f.size,
	sha256: f.sha256,
	version: f.version,
	contentType: f.contentType,
	updatedAt: f.updatedAt
});

export function fileService(deps: Deps) {
	const { db, adapters, config, logger } = deps;
	const files = fileRepository(db);
	const projects = projectRepository(db);

	const purge = (keys: (string | null | undefined)[]) => {
		const list = keys.filter((k): k is string => !!k);
		if (!list.length) return Promise.resolve();
		return adapters.queue.enqueue({ type: "blobs.delete", keys: list }).catch((error: unknown) => {
			logger.error("blob purge enqueue failed; keys orphaned", { error, keys: list.length });
		});
	};

	/** Validates size and encoding, and uploads binaries. Text that isn't UTF-8 is rejected. */
	async function store(
		projectId: string,
		path: string,
		bytes: Uint8Array,
		contentType: string | undefined,
		textFallsBackToBinary = false
	): Promise<StoredContent> {
		let kind: "text" | "binary" = isTextPath(path) ? "text" : "binary";
		let content: string | null = null;
		if (kind === "text") {
			if (bytes.byteLength > config.limits.textFileBytes) {
				throw errors.tooLarge(`Text files are limited to ${config.limits.textFileBytes} bytes.`);
			}
			try {
				content = strictUtf8.decode(bytes);
			} catch {
				if (!textFallsBackToBinary) throw errors.badRequest(`${path} is not valid UTF-8 text.`);
				kind = "binary";
			}
		}
		if (kind === "binary" && bytes.byteLength > config.limits.binaryFileBytes) {
			throw errors.tooLarge(`Files are limited to ${config.limits.binaryFileBytes} bytes.`);
		}
		const sha256 = await sha256Hex(bytes);
		if (kind === "text") {
			return { kind, content, blobKey: null, contentType: null, size: bytes.byteLength, sha256 };
		}
		const blobKey = `projects/${projectId}/${newId()}`;
		await adapters.blobs.put(blobKey, bytes, contentType);
		return {
			kind,
			content: null,
			blobKey,
			contentType: contentType ?? null,
			size: bytes.byteLength,
			sha256
		};
	}

	async function conflictFor(projectId: string, path: string) {
		const current = await files.get(projectId, path);
		if (!current) return errors.notFound("File");
		return errors.conflict("The file changed since you loaded it.", {
			currentVersion: current.version
		});
	}

	return {
		store,

		list: ({ project }: ProjectAccess, withText = false) =>
			withText ? files.listWithText(project.id) : files.list(project.id),

		async read({ project }: ProjectAccess, rawPath: string) {
			const file = await files.get(project.id, normalizePath(rawPath));
			if (!file) throw errors.notFound("File");
			if (file.kind === "text") return { file, text: file.content ?? "", blob: null };
			const blob = await adapters.blobs.get(file.blobKey as string);
			if (!blob) throw errors.notFound("File content");
			return { file, text: null, blob };
		},

		async write(
			{ project }: ProjectAccess,
			userId: string,
			rawPath: string,
			bytes: Uint8Array,
			contentType: string | undefined,
			pre: Precondition
		) {
			const path = normalizePath(rawPath);
			if ("create" in pre && (await files.count(project.id)) >= config.limits.filesPerProject) {
				throw errors.conflict(`Projects are limited to ${config.limits.filesPerProject} files.`);
			}
			const stored = await store(project.id, path, bytes, contentType);
			let previous: FileRow | null = null;
			try {
				let row: FileRow | null;
				if ("create" in pre) {
					row = await files.create({ projectId: project.id, path, ...stored, updatedBy: userId });
					if (!row) throw await conflictFor(project.id, path);
				} else {
					previous = await files.get(project.id, path);
					row = await files.updateIfVersion(project.id, path, pre.version, {
						...stored,
						updatedBy: userId
					});
					if (!row) throw await conflictFor(project.id, path);
				}
				await projects.touch(project.id);
				if (previous?.blobKey && previous.blobKey !== stored.blobKey)
					await purge([previous.blobKey]);
				return fileMeta(row);
			} catch (error) {
				await purge([stored.blobKey]);
				throw error;
			}
		},

		async remove({ project }: ProjectAccess, rawPath: string, version: number) {
			const path = normalizePath(rawPath);
			const row = await files.deleteIfVersion(project.id, path, version);
			if (!row) throw await conflictFor(project.id, path);
			await projects.touch(project.id);
			await purge([row.blobKey]);
		},

		async rename({ project }: ProjectAccess, rawFrom: string, rawTo: string, version: number) {
			const from = normalizePath(rawFrom);
			const to = normalizePath(rawTo);
			if (from === to) throw errors.badRequest("Source and destination are the same.");
			try {
				const row = await files.rename(project.id, from, to, version);
				if (!row) throw await conflictFor(project.id, from);
				await projects.touch(project.id);
				return fileMeta(row);
			} catch (error) {
				if (isUniqueViolation(error)) throw errors.conflict(`${to} already exists.`);
				throw error;
			}
		}
	};
}

export type FileService = ReturnType<typeof fileService>;
