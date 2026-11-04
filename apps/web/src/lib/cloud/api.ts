import type {
	AuditPage,
	Feature,
	MemberFeatures,
	OrgPolicy,
	OrgStats,
	OrgView,
	FileMeta,
	GrantableRole,
	ImportResult,
	Invite,
	Joined,
	MembersResponse,
	Problem,
	ProjectSummary,
	ProjectView,
	PublicConfig,
	ShareLink
} from "@glyphtex/server/contract";
import { createFetch } from "@better-fetch/fetch";
import { SERVER_URL } from "./config";

export type {
	AuditPage,
	Feature,
	MemberFeatures,
	OrgPolicy,
	OrgStats,
	OrgView,
	FileMeta,
	GrantableRole,
	Invite,
	MembersResponse,
	ProjectSummary,
	ProjectView,
	PublicConfig,
	ShareLink
};

/** Every server failure, already in plain language; `problem` keeps the raw detail. */
export class CloudError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly problem?: Problem
	) {
		super(message);
		this.name = "CloudError";
	}

	get conflict() {
		return this.status === 409;
	}
}

const OFFLINE = "Can't reach the GlyphTeX server. Check your connection and try again.";

const $fetch = createFetch({
	baseURL: `${SERVER_URL}/api`,
	credentials: "include",
	throw: false
});

// Reads are idempotent, so a dropped connection or a 5xx gets one quick retry. Writes
// never retry: a create or invite could otherwise land twice.
const READ_RETRY = {
	type: "exponential",
	attempts: 2,
	baseDelay: 300,
	maxDelay: 1500,
	shouldRetry: (res: Response | null) => res === null || res.status >= 500
} as const;

type Init = { method?: string; headers?: Record<string, string>; body?: unknown };

async function call<T>(path: string, init: Init = {}): Promise<T> {
	const method = init.method ?? "GET";
	let result: Awaited<ReturnType<typeof $fetch<T, Partial<Problem>>>>;
	try {
		result = await $fetch<T, Partial<Problem>>(path, {
			method,
			headers: init.headers,
			body: init.body,
			...(method === "GET" && { retry: READ_RETRY })
		});
	} catch {
		throw new CloudError(0, "offline", OFFLINE);
	}
	if (result.error) throw toError(result.error);
	return result.data as T;
}

function toError(error: Partial<Problem> & { status: number }): CloudError {
	const message =
		error.title ??
		(error.status === 401 ? "Sign in to continue." : `Request failed (${error.status}).`);
	return new CloudError(error.status, error.code ?? "http_error", message, error as Problem);
}

const json = <T>(path: string, init?: Init) => call<T>(path, init);
const done = async (path: string, init?: Init) => {
	await call<unknown>(path, init);
};
const bytes = async (path: string) => new Uint8Array(await (await call<Blob>(path)).arrayBuffer());
const p = (id: string) => `/projects/${encodeURIComponent(id)}`;
const o = (id: string) => `/orgs/${encodeURIComponent(id)}`;
const file = (id: string, path: string) => `${p(id)}/files/raw?path=${encodeURIComponent(path)}`;

/** `create` sends If-None-Match: *; a version sends If-Match, so stale writes 409. */
export type Precondition = { create: true } | { version: number };

const preconditionHeaders = (pre: Precondition): Record<string, string> =>
	"create" in pre ? { "if-none-match": "*" } : { "if-match": `"${pre.version}"` };

export const cloud = {
	config: () => json<PublicConfig>("/public/config"),

	projects: {
		list: async () => (await json<{ projects: ProjectSummary[] }>("/projects")).projects,
		/** With `orgId`, the project belongs to that organization. */
		create: async (name: string, orgId?: string) =>
			(
				await json<{ project: ProjectSummary }>("/projects", {
					method: "POST",
					body: { name, ...(orgId && { orgId }) }
				})
			).project,
		import: (name: string, zip: Uint8Array, orgId?: string) =>
			json<ImportResult>(
				`/projects/import?name=${encodeURIComponent(name)}${orgId ? `&orgId=${encodeURIComponent(orgId)}` : ""}`,
				{
					method: "POST",
					headers: { "content-type": "application/zip" },
					body: new Blob([zip as BlobPart], { type: "application/zip" })
				}
			),
		get: async (id: string) => (await json<{ project: ProjectView }>(p(id))).project,
		update: (id: string, patch: { name?: string; mainFile?: string }) =>
			json<{ project: ProjectSummary }>(p(id), { method: "PATCH", body: patch }),
		remove: (id: string) => done(p(id), { method: "DELETE" })
	},

	files: {
		list: async (id: string) =>
			(await json<{ files: FileMeta[] }>(`${p(id)}/files?content=text`)).files,
		bytes: (id: string, path: string) => bytes(file(id, path)),
		put: async (id: string, path: string, body: string | Uint8Array, pre: Precondition) =>
			(
				await json<{ file: FileMeta }>(file(id, path), {
					method: "PUT",
					headers: {
						...preconditionHeaders(pre),
						"content-type":
							typeof body === "string" ? "text/plain; charset=utf-8" : "application/octet-stream"
					},
					// A Blob, not a string: better-fetch JSON-encodes string bodies, quotes and all.
					body: new Blob([body as BlobPart])
				})
			).file,
		remove: (id: string, path: string, version: number) =>
			done(file(id, path), { method: "DELETE", headers: { "if-match": `"${version}"` } })
	},

	sharing: {
		members: (id: string) => json<MembersResponse>(`${p(id)}/members`),
		setRole: (id: string, userId: string, role: GrantableRole) =>
			done(`${p(id)}/members/${encodeURIComponent(userId)}`, { method: "PATCH", body: { role } }),
		removeMember: (id: string, userId: string) =>
			done(`${p(id)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" }),
		invites: async (id: string) => (await json<{ invites: Invite[] }>(`${p(id)}/invites`)).invites,
		invite: (id: string, email: string, role: GrantableRole) =>
			json<{ invite: Invite }>(`${p(id)}/invites`, { method: "POST", body: { email, role } }),
		revokeInvite: (id: string, inviteId: string) =>
			done(`${p(id)}/invites/${encodeURIComponent(inviteId)}`, { method: "DELETE" }),
		links: async (id: string) => (await json<{ links: ShareLink[] }>(`${p(id)}/links`)).links,
		createLink: async (id: string, role: GrantableRole, expiresInHours?: number) =>
			(
				await json<{ link: ShareLink }>(`${p(id)}/links`, {
					method: "POST",
					body: { role, expiresInHours }
				})
			).link,
		revokeLink: (id: string, linkId: string) =>
			done(`${p(id)}/links/${encodeURIComponent(linkId)}`, { method: "DELETE" }),
		acceptInvite: (token: string) =>
			json<Joined>("/invites/accept", { method: "POST", body: { token } }),
		redeemLink: (token: string) =>
			json<Joined>("/links/redeem", { method: "POST", body: { token } })
	},

	orgs: {
		view: (orgId: string) => json<OrgView>(o(orgId)),
		projects: async (orgId: string) =>
			(await json<{ projects: ProjectSummary[] }>(`${o(orgId)}/projects`)).projects,
		updatePolicy: async (orgId: string, patch: Partial<OrgPolicy>) =>
			(await json<{ policy: OrgPolicy }>(`${o(orgId)}/policy`, { method: "PATCH", body: patch }))
				.policy,
		memberFeatures: (orgId: string, userId: string) =>
			json<MemberFeatures>(`${o(orgId)}/members/${encodeURIComponent(userId)}/features`),
		/** `enabled: null` drops the override, so the org default applies again. */
		setMemberFeature: (orgId: string, userId: string, feature: Feature, enabled: boolean | null) =>
			json<MemberFeatures>(`${o(orgId)}/members/${encodeURIComponent(userId)}/features`, {
				method: "PUT",
				body: { feature, enabled }
			}),
		stats: async (orgId: string) => (await json<{ stats: OrgStats }>(`${o(orgId)}/stats`)).stats,
		audit: (orgId: string, before?: string) =>
			json<AuditPage>(
				`${o(orgId)}/audit?limit=50${before ? `&before=${encodeURIComponent(before)}` : ""}`
			),
		// better-fetch hands text/* back as a string, not a Blob.
		auditCsv: (orgId: string) => call<string>(`${o(orgId)}/audit.csv`)
	},

	account: {
		exportZip: () => bytes("/me/export")
	}
};
