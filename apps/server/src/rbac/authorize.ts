import type { ProjectRole } from "../db/schema.ts";
import { errors } from "../lib/errors.ts";
import type { ProjectRepository, ProjectRow } from "../repositories/projects.ts";
import { can, type ProjectPermission } from "./permissions.ts";

export interface ProjectAccess {
	project: ProjectRow;
	role: ProjectRole;
}

/**
 * Deny by default. A project the actor can't see is reported as missing (404), never 403,
 * so project ids can't be probed for existence.
 */
export async function authorizeProject(
	projects: ProjectRepository,
	userId: string,
	projectId: string,
	permission: ProjectPermission
): Promise<ProjectAccess> {
	const found = await projects.findWithRole(projectId, userId);
	if (!found?.role) throw errors.notFound("Project");
	if (!can(found.role, permission)) throw errors.forbidden();
	const orgId = found.project.organizationId;
	if (found.gate && orgId && (await projects.blockedByTwoFactor(orgId, userId))) {
		throw errors.twoFactorRequired();
	}
	return { project: found.project, role: found.role };
}
