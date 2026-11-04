import type { Deps } from "../context.ts";
import { newId } from "../lib/crypto.ts";
import { errors } from "../lib/errors.ts";
import { normalizePath } from "../lib/paths.ts";
import type { ProjectAccess } from "../rbac/authorize.ts";
import { capabilities } from "../rbac/permissions.ts";
import { projectRepository } from "../repositories/projects.ts";

export function projectService({ db, adapters, logger }: Deps) {
	const projects = projectRepository(db);

	return {
		list: (userId: string) => projects.listForUser(userId),

		create: (ownerId: string, name: string) =>
			projects.create({ id: newId(), name, ownerId, mainFile: "main.tex" }),

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
		async remove({ project }: ProjectAccess) {
			const keys = await projects.blobKeysForProjects([project.id]);
			await projects.delete(project.id);
			if (keys.length) {
				await adapters.queue.enqueue({ type: "blobs.delete", keys }).catch((error: unknown) => {
					logger.error("blob purge enqueue failed; keys orphaned", { error, keys: keys.length });
				});
			}
		}
	};
}
