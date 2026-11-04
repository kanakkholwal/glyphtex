import type { Deps } from "../context.ts";
import { newId } from "../lib/crypto.ts";
import { errors } from "../lib/errors.ts";
import { normalizePath } from "../lib/paths.ts";
import type { ProjectAccess } from "../rbac/authorize.ts";
import { capabilities } from "../rbac/permissions.ts";
import { orgRepository } from "../repositories/orgs.ts";
import { projectRepository } from "../repositories/projects.ts";
import { authorizeOrg } from "./orgs.ts";

export function projectService({ db, adapters, logger }: Deps) {
	const projects = projectRepository(db);

	return {
		list: (userId: string) => projects.listForUser(userId),

		/** In an org, any member may create; the project then belongs to the org. */
		async create(ownerId: string, name: string, orgId?: string) {
			if (orgId) await authorizeOrg({ db }, ownerId, orgId, "org:create-project");
			const created = await projects.create({
				id: newId(),
				name,
				ownerId,
				organizationId: orgId ?? null,
				mainFile: "main.tex"
			});
			if (orgId) {
				await orgRepository(db).audit({
					organizationId: orgId,
					actorId: ownerId,
					action: "project.created",
					targetType: "project",
					targetId: created.id,
					meta: { name }
				});
			}
			return created;
		},

		view: ({ project, role }: ProjectAccess) => ({
			...project,
			role,
			capabilities: capabilities(role)
		}),

		async update({ project }: ProjectAccess, values: { name?: string; mainFile?: string }) {
			const patch = {
				...(values.name !== undefined && { name: values.name }),
				...(values.mainFile !== undefined && { mainFile: normalizePath(values.mainFile) })
			};
			const row = await projects.update(project.id, patch);
			if (!row) throw errors.notFound("Project");
			return row;
		},

		/** Rows first, then the blob purge: a failed enqueue leaves orphans, never lost data. */
		async remove({ project }: ProjectAccess, actorId: string) {
			const keys = await projects.blobKeysForProjects([project.id]);
			await projects.delete(project.id);
			if (project.organizationId) {
				await orgRepository(db).audit({
					organizationId: project.organizationId,
					actorId,
					action: "project.deleted",
					targetType: "project",
					targetId: project.id,
					meta: { name: project.name }
				});
			}
			if (keys.length) {
				await adapters.queue.enqueue({ type: "blobs.delete", keys }).catch((error: unknown) => {
					logger.error("blob purge enqueue failed; keys orphaned", { error, keys: keys.length });
				});
			}
		}
	};
}
