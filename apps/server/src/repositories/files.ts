import { and, asc, count, eq } from "drizzle-orm";
import type { Db, Tx } from "../db/client.ts";
import { projectFile } from "../db/schema.ts";

export type FileRow = typeof projectFile.$inferSelect;
export type FileInsert = typeof projectFile.$inferInsert;

const META = {
	path: projectFile.path,
	kind: projectFile.kind,
	size: projectFile.size,
	sha256: projectFile.sha256,
	version: projectFile.version,
	contentType: projectFile.contentType,
	updatedAt: projectFile.updatedAt
};

export function fileRepository(db: Db | Tx) {
	const key = (projectId: string, path: string) =>
		and(eq(projectFile.projectId, projectId), eq(projectFile.path, path));

	return {
		list(projectId: string) {
			return db
				.select(META)
				.from(projectFile)
				.where(eq(projectFile.projectId, projectId))
				.orderBy(asc(projectFile.path));
		},

		listFull(projectId: string) {
			return db.select().from(projectFile).where(eq(projectFile.projectId, projectId));
		},

		async get(projectId: string, path: string) {
			const [row] = await db.select().from(projectFile).where(key(projectId, path)).limit(1);
			return row ?? null;
		},

		async count(projectId: string) {
			const [row] = await db
				.select({ n: count() })
				.from(projectFile)
				.where(eq(projectFile.projectId, projectId));
			return row?.n ?? 0;
		},

		/** Insert only if absent; null means the path already exists. */
		async create(values: FileInsert) {
			const [row] = await db.insert(projectFile).values(values).onConflictDoNothing().returning();
			return row ?? null;
		},

		/** Optimistic concurrency: writes only when `expectedVersion` is still current. */
		async updateIfVersion(
			projectId: string,
			path: string,
			expectedVersion: number,
			values: Omit<FileInsert, "projectId" | "path" | "version">
		) {
			const [row] = await db
				.update(projectFile)
				.set({ ...values, version: expectedVersion + 1 })
				.where(and(key(projectId, path), eq(projectFile.version, expectedVersion)))
				.returning();
			return row ?? null;
		},

		async deleteIfVersion(projectId: string, path: string, expectedVersion: number) {
			const [row] = await db
				.delete(projectFile)
				.where(and(key(projectId, path), eq(projectFile.version, expectedVersion)))
				.returning();
			return row ?? null;
		},

		async rename(projectId: string, from: string, to: string, expectedVersion: number) {
			const [row] = await db
				.update(projectFile)
				.set({ path: to, version: expectedVersion + 1 })
				.where(and(key(projectId, from), eq(projectFile.version, expectedVersion)))
				.returning();
			return row ?? null;
		}
	};
}

export type FileRepository = ReturnType<typeof fileRepository>;
