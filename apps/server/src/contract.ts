// Wire types shared with the web client (`@glyphtex/server/contract`). Dates arrive as ISO strings.
import type { GrantableRole, ProjectRole } from "./db/schema.ts";
import type { ProjectPermission } from "./rbac/permissions.ts";

export type { GrantableRole, ProjectPermission, ProjectRole };

export interface ProjectSummary {
	id: string;
	name: string;
	mainFile: string;
	ownerId: string;
	role: ProjectRole;
	createdAt: string;
	updatedAt: string;
}

export interface ProjectView extends Omit<ProjectSummary, "role"> {
	role: ProjectRole;
	capabilities: ProjectPermission[];
}

export interface FileMeta {
	path: string;
	kind: "text" | "binary";
	size: number;
	sha256: string;
	version: number;
	contentType: string | null;
	updatedAt: string;
	/** Present for text files when listed with `?content=text`. */
	content?: string;
}

export interface Member {
	userId: string;
	role: ProjectRole;
	name: string;
	email: string;
	image: string | null;
}

export interface MembersResponse {
	owner: Member | undefined;
	members: (Omit<Member, "role"> & { role: GrantableRole; since: string })[];
}

export interface Invite {
	id: string;
	email: string;
	role: GrantableRole;
	expiresAt: string;
}

export interface ShareLink {
	id: string;
	role: GrantableRole;
	expiresAt: string | null;
	createdAt: string;
	/** Only on creation: the token is never retrievable again. */
	url?: string;
}

export interface Joined {
	projectId: string;
	role: ProjectRole;
}

export interface ImportResult {
	project: Omit<ProjectSummary, "role">;
	files: number;
	skipped: string[];
}

export interface PublicConfig {
	providers: ("google" | "github" | "gitlab")[];
	magicLink: boolean;
	limits: { textFileBytes: number; binaryFileBytes: number; filesPerProject: number };
}

/** RFC 9457 problem details, plus our `code` and any detail fields. */
export interface Problem {
	type: string;
	title: string;
	status: number;
	code: string;
	requestId?: string;
	currentVersion?: number;
	retryAfterSeconds?: number;
	issues?: { path: string; message: string }[];
}
