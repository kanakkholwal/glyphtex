import { and, asc, desc, eq } from "drizzle-orm";
import type { Deps } from "../context.ts";
import { projectVersion, projectVersionFile, user } from "../db/schema.ts";
import { newId, sha256Hex } from "../lib/crypto.ts";
import { errors } from "../lib/errors.ts";
import { normalizePath } from "../lib/paths.ts";
import type { ProjectAccess } from "../rbac/authorize.ts";
import { fileRepository } from "../repositories/files.ts";
import { fileService } from "./files.ts";

/** Named versions are kept until someone deletes them; automatic ones are trimmed to the newest few. */
export const VERSION_LIMITS = { named: 50, auto: 10, nameChars: 120 } as const;

const encoder = new TextEncoder();

export function versionService(deps: Deps) {
	const { db, config } = deps;

	async function version(projectId: string, id: string) {
		const [row] = await db
			.select()
			.from(projectVersion)
			.where(and(eq(projectVersion.projectId, projectId), eq(projectVersion.id, id)));
		if (!row) throw errors.notFound("Version");
		return row;
	}

	/** Saves every text file as it is now. Images and other binaries are not part of a version. */
	async function snapshot(
		access: ProjectAccess,
		userId: string,
		kind: "named" | "auto",
		name: string | null
	) {
		const { project } = access;
		const rows = (await fileRepository(db).listWithText(project.id)).filter(
			(f) => f.kind === "text" && f.content !== null
		);
		const bytes = rows.reduce((n, f) => n + f.size, 0);
		if (bytes > config.limits.importBytes) {
			throw errors.tooLarge("This project's text is too large to save as a version.");
		}
		if (kind === "named") {
			const named = await db
				.select({ id: projectVersion.id })
				.from(projectVersion)
				.where(and(eq(projectVersion.projectId, project.id), eq(projectVersion.kind, "named")));
			if (named.length >= VERSION_LIMITS.named) {
				throw errors.conflict(
					`A project keeps up to ${VERSION_LIMITS.named} named versions. Delete one first.`
				);
			}
		}
		const id = newId();
		await db.transaction(async (tx) => {
			await tx.insert(projectVersion).values({
				id,
				projectId: project.id,
				name,
				kind,
				createdBy: userId,
				fileCount: rows.length,
				bytes
			});
			for (const f of rows) {
				await tx.insert(projectVersionFile).values({
					versionId: id,
					path: f.path,
					content: f.content as string,
					sha256: f.sha256,
					size: f.size
				});
			}
		});
		if (kind === "auto") await trimAuto(project.id);
		return id;
	}

	async function trimAuto(projectId: string) {
		const autos = await db
			.select({ id: projectVersion.id })
			.from(projectVersion)
			.where(and(eq(projectVersion.projectId, projectId), eq(projectVersion.kind, "auto")))
			.orderBy(desc(projectVersion.createdAt));
		for (const old of autos.slice(VERSION_LIMITS.auto)) {
			await db.delete(projectVersion).where(eq(projectVersion.id, old.id));
		}
	}

	return {
		async list({ project }: ProjectAccess) {
			return db
				.select({
					id: projectVersion.id,
					name: projectVersion.name,
					kind: projectVersion.kind,
					fileCount: projectVersion.fileCount,
					bytes: projectVersion.bytes,
					createdAt: projectVersion.createdAt,
					createdByName: user.name
				})
				.from(projectVersion)
				.leftJoin(user, eq(user.id, projectVersion.createdBy))
				.where(eq(projectVersion.projectId, project.id))
				.orderBy(desc(projectVersion.createdAt));
		},

		async create(access: ProjectAccess, userId: string, name: string) {
			const trimmed = name.trim().slice(0, VERSION_LIMITS.nameChars);
			if (!trimmed) throw errors.badRequest("Give the version a name.");
			return { id: await snapshot(access, userId, "named", trimmed) };
		},

		async files({ project }: ProjectAccess, id: string) {
			await version(project.id, id);
			return db
				.select({
					path: projectVersionFile.path,
					size: projectVersionFile.size,
					sha256: projectVersionFile.sha256
				})
				.from(projectVersionFile)
				.where(eq(projectVersionFile.versionId, id))
				.orderBy(asc(projectVersionFile.path));
		},

		async readFile({ project }: ProjectAccess, id: string, rawPath: string) {
			await version(project.id, id);
			const [row] = await db
				.select({ content: projectVersionFile.content })
				.from(projectVersionFile)
				.where(
					and(
						eq(projectVersionFile.versionId, id),
						eq(projectVersionFile.path, normalizePath(rawPath))
					)
				);
			if (!row) throw errors.notFound("File");
			return row.content;
		},

		async rename({ project }: ProjectAccess, id: string, name: string) {
			const row = await version(project.id, id);
			if (row.kind !== "named") throw errors.badRequest("Only named versions can be renamed.");
			const trimmed = name.trim().slice(0, VERSION_LIMITS.nameChars);
			if (!trimmed) throw errors.badRequest("Give the version a name.");
			await db.update(projectVersion).set({ name: trimmed }).where(eq(projectVersion.id, id));
		},

		async remove({ project }: ProjectAccess, id: string) {
			await version(project.id, id);
			await db.delete(projectVersion).where(eq(projectVersion.id, id));
		},

		/**
		 * Puts a version's text files back. Files created after it are left alone. A safety copy of the
		 * current state is saved first, so a restore can itself be undone.
		 */
		async restore(access: ProjectAccess, userId: string, id: string) {
			const target = await version(access.project.id, id);
			const files = await db
				.select()
				.from(projectVersionFile)
				.where(eq(projectVersionFile.versionId, id));
			await snapshot(
				access,
				userId,
				"auto",
				`Before restoring "${target.name ?? "an earlier version"}"`
			);
			const fileSvc = fileService(deps);
			const repo = fileRepository(db);
			let restored = 0;
			for (const f of files) {
				const bytes = encoder.encode(f.content);
				const current = await repo.get(access.project.id, f.path);
				if (current && current.kind !== "text") continue;
				if (current && (await sha256Hex(bytes)) === current.sha256) continue;
				await fileSvc.write(
					access,
					userId,
					f.path,
					bytes,
					"text/plain",
					current ? { version: current.version } : { create: true }
				);
				restored++;
			}
			return { restored };
		}
	};
}

export type VersionService = ReturnType<typeof versionService>;
