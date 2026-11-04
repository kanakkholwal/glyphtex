import type { ProjectRole } from "../db/schema.ts";

export const PROJECT_PERMISSIONS = [
	"project:read",
	"project:comment",
	"project:write",
	"project:rename",
	"project:share",
	"project:delete"
] as const;

export type ProjectPermission = (typeof PROJECT_PERMISSIONS)[number];

const VIEWER: readonly ProjectPermission[] = ["project:read"];
const COMMENTER: readonly ProjectPermission[] = [...VIEWER, "project:comment"];
const EDITOR: readonly ProjectPermission[] = [...COMMENTER, "project:write", "project:rename"];

/** The single grant table. Every access decision for a project resolves through it. */
export const ROLE_GRANTS: Record<ProjectRole, ReadonlySet<ProjectPermission>> = {
	viewer: new Set(VIEWER),
	commenter: new Set(COMMENTER),
	editor: new Set(EDITOR),
	owner: new Set(PROJECT_PERMISSIONS)
};

export const can = (role: ProjectRole | null, permission: ProjectPermission) =>
	role !== null && ROLE_GRANTS[role].has(permission);

/** What the UI may offer; the server still re-checks every request. */
export const capabilities = (role: ProjectRole) => [...ROLE_GRANTS[role]];

const RANK: Record<ProjectRole, number> = { viewer: 0, commenter: 1, editor: 2, owner: 3 };

/** Joining via a link never downgrades someone who already has a stronger role. */
export const strongerRole = <R extends ProjectRole>(a: R, b: R): R => (RANK[a] >= RANK[b] ? a : b);
