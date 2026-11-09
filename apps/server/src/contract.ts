// Wire types shared with the web client (`@glyphtex/server/contract`). Dates arrive as ISO strings.
import type { GrantableRole, ProjectRole } from "./db/schema.ts";
import type { ProjectPermission } from "./rbac/permissions.ts";

import type { MemberAccess, Feature } from "./db/schema.ts";
import type { OrgPermission } from "./rbac/org.ts";

export type { Feature, GrantableRole, MemberAccess, OrgPermission, ProjectPermission, ProjectRole };

export interface ProjectSummary {
	id: string;
	name: string;
	mainFile: string;
	ownerId: string;
	organizationId: string | null;
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
	providers: ("google" | "github" | "gitlab" | "orcid")[];
	/** True only when the server can send mail. */
	magicLink: boolean;
	/** What this server has switched on; the client skips what it can't do. */
	features: { mail: boolean; blobs: boolean };
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

export interface OrgPolicy {
	memberAccess: MemberAccess;
	shareLinks: boolean;
	externalInvites: boolean;
	ai: boolean;
	requireTwoFactor: boolean;
	seatLimit: number | null;
}

export interface OrgView {
	organization: { id: string; name: string; slug: string; logo: string | null; createdAt: string };
	role: string;
	capabilities: OrgPermission[];
	policy: OrgPolicy;
	/** What the signed-in member can use here, after their personal overrides. */
	features: Record<Feature, boolean>;
}

export interface MemberFeatures {
	policy: OrgPolicy;
	features: Record<Feature, boolean>;
}

export interface OrgStats {
	members: number;
	projects: number;
	storageBytes: number;
	activeMembers30d: number;
	projectsEdited7d: number;
}

export interface AuditEvent {
	id: string;
	action: string;
	targetType: string;
	targetId: string | null;
	meta: Record<string, string | number | boolean | null> | null;
	createdAt: string;
	actorId: string | null;
	actorName: string | null;
	actorEmail: string | null;
}

export interface AuditPage {
	events: AuditEvent[];
	/** Pass as `before` for the next page; null on the last one. */
	next: string | null;
}

export interface OrgTemplate {
	projectId: string;
	title: string;
	description: string;
	mainFile: string;
	createdAt: string;
}

/** Files every compile of the org's projects can use. Binaries are fetched from `library/raw`. */
export interface OrgLibrary {
	projectId: string | null;
	files: {
		path: string;
		kind: "text" | "binary";
		content: string | null;
		sha256: string;
		size: number;
	}[];
}

export interface SsoProvider {
	providerId: string;
	domain: string;
	issuer: string;
	domainVerified: boolean;
	type: "oidc" | "saml";
}

export interface ScimConnection {
	connectionId: string;
	status: string;
	createdAt: string;
}

export interface ScimOverview {
	/** The base URL to paste into the identity provider. */
	url: string;
	connections: ScimConnection[];
}

/** Shown once: only a keyed digest of the token is stored. */
export interface ScimToken {
	url: string;
	connectionId: string;
	token: string;
}
