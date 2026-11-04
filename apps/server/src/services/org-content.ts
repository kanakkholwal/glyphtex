import { and, eq } from "drizzle-orm";
import type { Deps } from "../context.ts";
import { orgLibrary, orgTemplate, project, projectFile } from "../db/schema.ts";
import { newId, sha256Hex } from "../lib/crypto.ts";
import { errors } from "../lib/errors.ts";
import { orgRepository } from "../repositories/orgs.ts";
import type { OrgAccess } from "./orgs.ts";

/** Org templates (projects members start from) and the shared package library. */
export function orgContentService(deps: Deps) {
	const { db, adapters, logger } = deps;
	const orgs = orgRepository(db);

	async function orgProject(orgId: string, projectId: string) {
		const [row] = await db
			.select()
			.from(project)
			.where(and(eq(project.id, projectId), eq(project.organizationId, orgId)))
			.limit(1);
		if (!row) throw errors.notFound("Project");
		return row;
	}

	/** Server-side copy into the org: text rows copied, binaries duplicated under new keys. */
	async function copyProject(sourceId: string, orgId: string, ownerId: string, name: string) {
		const src = await db.select().from(projectFile).where(eq(projectFile.projectId, sourceId));
		const source = await orgProject(orgId, sourceId);
		const id = newId();
		const copied: string[] = [];
		try {
			const rows: (typeof projectFile.$inferInsert)[] = [];
			for (const f of src) {
				let blobKey: string | null = null;
				if (f.blobKey) {
					const blob = await adapters.blobs.get(f.blobKey);
					if (!blob) continue;
					blobKey = `projects/${id}/${newId()}`;
					const bytes = new Uint8Array(await new Response(blob.body).arrayBuffer());
					await adapters.blobs.put(blobKey, bytes, f.contentType ?? undefined);
					copied.push(blobKey);
				}
				rows.push({ ...f, projectId: id, blobKey, version: 1, updatedBy: ownerId });
			}
			const created = await db.transaction(async (tx) => {
				const [p] = await tx
					.insert(project)
					.values({ id, name, ownerId, organizationId: orgId, mainFile: source.mainFile })
					.returning();
				for (let i = 0; i < rows.length; i += 500) {
					await tx.insert(projectFile).values(rows.slice(i, i + 500));
				}
				return p;
			});
			if (!created) throw new Error("project insert returned no row");
			return { ...created, role: "owner" as const };
		} catch (error) {
			if (copied.length) {
				await adapters.queue.enqueue({ type: "blobs.delete", keys: copied }).catch((e: unknown) => {
					logger.error("blob purge enqueue failed; keys orphaned", { error: e });
				});
			}
			throw error;
		}
	}

	return {
		listTemplates: ({ orgId }: OrgAccess) =>
			db
				.select({
					projectId: orgTemplate.projectId,
					title: orgTemplate.title,
					description: orgTemplate.description,
					mainFile: project.mainFile,
					createdAt: orgTemplate.createdAt
				})
				.from(orgTemplate)
				.innerJoin(project, eq(project.id, orgTemplate.projectId))
				.where(eq(orgTemplate.organizationId, orgId))
				.orderBy(orgTemplate.title),

		async saveTemplate(
			{ orgId }: OrgAccess,
			actorId: string,
			projectId: string,
			values: { title: string; description: string }
		) {
			await orgProject(orgId, projectId);
			await db
				.insert(orgTemplate)
				.values({ projectId, organizationId: orgId, ...values, createdBy: actorId })
				.onConflictDoUpdate({ target: orgTemplate.projectId, set: values });
			await orgs.audit({
				organizationId: orgId,
				actorId,
				action: "template.saved",
				targetType: "project",
				targetId: projectId,
				meta: { title: values.title }
			});
		},

		async removeTemplate({ orgId }: OrgAccess, actorId: string, projectId: string) {
			const rows = await db
				.delete(orgTemplate)
				.where(and(eq(orgTemplate.projectId, projectId), eq(orgTemplate.organizationId, orgId)))
				.returning();
			if (!rows.length) throw errors.notFound("Template");
			await orgs.audit({
				organizationId: orgId,
				actorId,
				action: "template.removed",
				targetType: "project",
				targetId: projectId
			});
		},

		/** Any member may start from a template, even one in a project they can't open. */
		async useTemplate({ orgId }: OrgAccess, userId: string, projectId: string, name: string) {
			const [t] = await db
				.select()
				.from(orgTemplate)
				.where(and(eq(orgTemplate.projectId, projectId), eq(orgTemplate.organizationId, orgId)))
				.limit(1);
			if (!t) throw errors.notFound("Template");
			const created = await copyProject(projectId, orgId, userId, name);
			await orgs.audit({
				organizationId: orgId,
				actorId: userId,
				action: "project.created",
				targetType: "project",
				targetId: created.id,
				meta: { name, fromTemplate: t.title }
			});
			return created;
		},

		async library({ orgId }: OrgAccess) {
			const [lib] = await db
				.select()
				.from(orgLibrary)
				.where(eq(orgLibrary.organizationId, orgId))
				.limit(1);
			if (!lib) return { projectId: null, files: [] };
			const files = await db
				.select({
					path: projectFile.path,
					kind: projectFile.kind,
					content: projectFile.content,
					sha256: projectFile.sha256,
					size: projectFile.size
				})
				.from(projectFile)
				.where(eq(projectFile.projectId, lib.projectId));
			return { projectId: lib.projectId, files };
		},

		/** Members need library binaries (fonts) even without access to the library project. */
		async libraryFile({ orgId }: OrgAccess, path: string) {
			const [row] = await db
				.select({ blobKey: projectFile.blobKey, contentType: projectFile.contentType })
				.from(orgLibrary)
				.innerJoin(projectFile, eq(projectFile.projectId, orgLibrary.projectId))
				.where(and(eq(orgLibrary.organizationId, orgId), eq(projectFile.path, path)))
				.limit(1);
			if (!row?.blobKey) throw errors.notFound("File");
			const blob = await adapters.blobs.get(row.blobKey);
			if (!blob) throw errors.notFound("File");
			return blob;
		},

		/** Creates the org's "Shared packages" project once; returns its id either way. */
		async ensureLibrary({ orgId }: OrgAccess, actorId: string) {
			const [existing] = await db
				.select()
				.from(orgLibrary)
				.where(eq(orgLibrary.organizationId, orgId))
				.limit(1);
			if (existing) return existing.projectId;
			const id = newId();
			const readme = new TextEncoder().encode(
				"Files here (.sty, .cls, .bst, .bib, fonts) are added to every compile of this organization's projects.\n"
			);
			const sha256 = await sha256Hex(readme);
			await db.transaction(async (tx) => {
				await tx.insert(project).values({
					id,
					name: "Shared packages",
					ownerId: actorId,
					organizationId: orgId,
					mainFile: "README.txt"
				});
				await tx.insert(projectFile).values({
					projectId: id,
					path: "README.txt",
					kind: "text",
					content: new TextDecoder().decode(readme),
					size: readme.byteLength,
					sha256,
					updatedBy: actorId
				});
				await tx.insert(orgLibrary).values({ organizationId: orgId, projectId: id });
			});
			await orgs.audit({
				organizationId: orgId,
				actorId,
				action: "library.created",
				targetType: "project",
				targetId: id
			});
			return id;
		}
	};
}
