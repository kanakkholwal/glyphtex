import { strToU8, unzipSync, Zip, ZipDeflate, ZipPassThrough } from "fflate";
import type { Deps } from "../context.ts";
import { newId } from "../lib/crypto.ts";
import { errors } from "../lib/errors.ts";
import { normalizePath } from "../lib/paths.ts";
import { fileRepository } from "../repositories/files.ts";
import { projectRepository } from "../repositories/projects.ts";
import { projectFile } from "../db/schema.ts";
import { fileService, type StoredContent } from "./files.ts";

const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|\.git)(\/|$)/;
const UPLOAD_CONCURRENCY = 8;
const INSERT_BATCH = 500;

/** Overleaf, Prism and GitHub zips often wrap everything in one top folder; drop it. */
function stripSharedRoot(paths: string[]) {
	const first = paths[0]?.split("/")[0];
	if (!first || !paths.every((p) => p.startsWith(`${first}/`))) return (p: string) => p;
	return (p: string) => p.slice(first.length + 1);
}

/** `main.tex` if present, else the shallowest .tex that declares a document class. */
export function detectMainFile(entries: { path: string; content: string | null }[]) {
	const tex = entries.filter((e) => e.path.endsWith(".tex"));
	if (tex.some((e) => e.path === "main.tex")) return "main.tex";
	const roots = tex
		.filter((e) => e.content && /\\documentclass/.test(e.content))
		.sort((a, b) => a.path.split("/").length - b.path.split("/").length);
	return roots[0]?.path ?? tex[0]?.path ?? "main.tex";
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
	const results: R[] = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const i = next++;
			results[i] = await fn(items[i] as T);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

export function archiveService(deps: Deps) {
	const { db, adapters, config, logger } = deps;

	return {
		async importZip(ownerId: string, name: string, zip: Uint8Array) {
			if (zip.byteLength > config.limits.importBytes) {
				throw errors.tooLarge(`Imports are limited to ${config.limits.importBytes} bytes.`);
			}
			let total = 0;
			let unpacked: Record<string, Uint8Array>;
			try {
				// The filter sees declared sizes before inflating, which stops zip bombs early.
				unpacked = unzipSync(zip, {
					filter: (f) => {
						if (f.name.endsWith("/") || JUNK.test(f.name)) return false;
						total += f.originalSize;
						if (total > config.limits.importBytes) {
							throw errors.tooLarge("The archive expands beyond the import limit.");
						}
						return true;
					}
				});
			} catch (error) {
				if (error instanceof Error && error.name === "AppError") throw error;
				throw errors.badRequest("That file isn't a readable zip archive.");
			}

			const names = Object.keys(unpacked);
			if (names.length === 0) throw errors.badRequest("The archive is empty.");
			if (names.length > config.limits.filesPerProject) {
				throw errors.tooLarge(`Projects are limited to ${config.limits.filesPerProject} files.`);
			}
			const strip = stripSharedRoot(names);
			const projectId = newId();
			const files = fileService(deps);
			const skipped: string[] = [];
			const uploaded: string[] = [];

			const prepared = await mapLimit(names, UPLOAD_CONCURRENCY, async (raw) => {
				let path: string;
				try {
					path = normalizePath(strip(raw));
				} catch {
					skipped.push(raw);
					return null;
				}
				const stored: StoredContent = await files.store(
					projectId,
					path,
					unpacked[raw] as Uint8Array,
					undefined,
					true
				);
				if (stored.blobKey) uploaded.push(stored.blobKey);
				return { path, ...stored };
			}).catch(async (error: unknown) => {
				await purgeQuietly(uploaded);
				throw error;
			});

			const entries = prepared.filter((e): e is NonNullable<typeof e> => e !== null);
			try {
				const project = await db.transaction(async (tx) => {
					const created = await projectRepository(tx).create({
						id: projectId,
						name,
						ownerId,
						mainFile: detectMainFile(entries)
					});
					for (let i = 0; i < entries.length; i += INSERT_BATCH) {
						await tx.insert(projectFile).values(
							entries.slice(i, i + INSERT_BATCH).map((e) => ({
								...e,
								projectId,
								updatedBy: ownerId
							}))
						);
					}
					return created;
				});
				return { project, files: entries.length, skipped };
			} catch (error) {
				await purgeQuietly(uploaded);
				throw error;
			}
		},

		/**
		 * Streams a zip of every project the user owns, one folder per project. Rows are read
		 * up front because a request-scoped DB connection closes when the handler returns.
		 */
		async exportOwned(userId: string): Promise<ReadableStream<Uint8Array>> {
			const fileRepo = fileRepository(db);
			const used = new Set<string>();
			const owned = await projectRepository(db).listOwned(userId);
			const plan = await Promise.all(
				owned.map(async (p) => ({
					folder: uniqueFolder(p.name, used),
					files: await fileRepo.listFull(p.id)
				}))
			);
			return new ReadableStream<Uint8Array>({
				async start(controller) {
					const zip = new Zip((err, chunk, final) => {
						if (err) return controller.error(err);
						controller.enqueue(chunk);
						if (final) controller.close();
					});
					try {
						for (const { folder, files } of plan) {
							for (const f of files) {
								const name = `${folder}/${f.path}`;
								if (f.kind === "text") {
									const entry = new ZipDeflate(name, { level: 6 });
									zip.add(entry);
									entry.push(strToU8(f.content ?? ""), true);
									continue;
								}
								const blob = await adapters.blobs.get(f.blobKey as string);
								const entry = new ZipPassThrough(name);
								zip.add(entry);
								if (!blob) {
									entry.push(new Uint8Array(), true);
									continue;
								}
								const reader = blob.body.getReader();
								for (;;) {
									const { done, value } = await reader.read();
									if (done) break;
									entry.push(value);
								}
								entry.push(new Uint8Array(), true);
							}
						}
						zip.end();
					} catch (error) {
						logger.error("account export failed", { error, userId });
						controller.error(error);
					}
				}
			});
		}
	};

	async function purgeQuietly(keys: string[]) {
		if (!keys.length) return;
		await adapters.queue.enqueue({ type: "blobs.delete", keys }).catch((error: unknown) => {
			logger.error("blob purge enqueue failed; keys orphaned", { error, keys: keys.length });
		});
	}
}

function uniqueFolder(name: string, used: Set<string>) {
	const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim() || "project";
	let candidate = base;
	for (let i = 2; used.has(candidate); i++) candidate = `${base} (${i})`;
	used.add(candidate);
	return candidate;
}
