import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { user } from "../src/db/schema.ts";
import { type Integration, integrationEnabled, startIntegration } from "./support.ts";

type Client = InstanceType<Integration["Client"]>;

describe("organizations end to end", {
	skip: integrationEnabled ? false : "set GLYPHTEX_IT=1"
}, () => {
	let it: Integration;
	let owner: Client;
	let admin: Client;
	let member: Client;
	let outsider: Client;
	let orgId = "";
	let projectId = "";

	before(async () => {
		it = await startIntegration();
		owner = new it.Client("org-owner");
		admin = new it.Client("org-admin");
		member = new it.Client("org-member");
		outsider = new it.Client("outsider");
		await Promise.all([owner.signUp(), admin.signUp(), member.signUp(), outsider.signUp()]);
	});

	after(async () => {
		await it?.stop();
	});

	async function join(c: Client, role: "admin" | "member") {
		const res = await owner.json("/api/auth/organization/invite-member", "POST", {
			email: c.email,
			role,
			organizationId: orgId
		});
		assert.equal(res.status, 200, await res.clone().text());
		const link = await it.latestLink(c.email, "/org-invite/");
		const invitationId = decodeURIComponent(link.pathname.split("/").pop() ?? "");
		const accepted = await c.json("/api/auth/organization/accept-invitation", "POST", {
			invitationId
		});
		assert.equal(accepted.status, 200, await accepted.clone().text());
	}

	const policy = (c: Client, patch: Record<string, unknown>) =>
		c.json(`/api/orgs/${orgId}/policy`, "PATCH", patch);
	const roleOn = async (c: Client, id: string) => {
		const res = await c.request(`/api/projects/${id}`);
		return res.status === 200
			? ((await res.json()) as { project: { role: string } }).project.role
			: res.status;
	};

	test("an owner creates an org and invites people by email", async () => {
		const res = await owner.json("/api/auth/organization/create", "POST", {
			name: "Physics Lab",
			slug: `physics-${Date.now().toString(36)}`
		});
		assert.equal(res.status, 200, await res.clone().text());
		orgId = ((await res.json()) as { id: string }).id;
		await join(admin, "admin");
		await join(member, "member");

		const view = await member.request(`/api/orgs/${orgId}`);
		const body = (await view.json()) as {
			role: string;
			capabilities: string[];
			features: Record<string, boolean>;
		};
		assert.equal(body.role, "member");
		assert.ok(!body.capabilities.includes("org:manage-policy"));
		assert.deepEqual(body.features, { ai: false, shareLinks: true, externalInvites: true });
		assert.equal(
			(await outsider.request(`/api/orgs/${orgId}`)).status,
			404,
			"non-members can't see the org"
		);
	});

	test("org projects follow org roles and the member access policy", async () => {
		const created = await owner.json("/api/projects", "POST", { name: "Thesis", orgId });
		assert.equal(created.status, 201);
		projectId = ((await created.json()) as { project: { id: string } }).project.id;
		const notMine = await outsider.json("/api/projects", "POST", { name: "x", orgId });
		assert.equal(notMine.status, 404, "only members create org projects");

		assert.equal(await roleOn(admin, projectId), "owner", "admins manage every org project");
		assert.equal(await roleOn(member, projectId), "editor", "members get the default access");
		assert.equal(await roleOn(outsider, projectId), 404);

		assert.equal((await policy(member, { memberAccess: "viewer" })).status, 403);
		assert.equal((await policy(admin, { memberAccess: "viewer" })).status, 200);
		assert.equal(await roleOn(member, projectId), "viewer");
		const write = await member.request(`/api/projects/${projectId}/files/raw?path=main.tex`, {
			method: "PUT",
			headers: { "if-none-match": "*" },
			body: "x"
		});
		assert.equal(write.status, 403);

		await policy(admin, { memberAccess: "none" });
		assert.equal(await roleOn(member, projectId), 404, "access none hides org projects");
		const list = await member.request(`/api/orgs/${orgId}/projects`);
		assert.deepEqual(((await list.json()) as { projects: unknown[] }).projects, []);
		await policy(admin, { memberAccess: "editor" });
	});

	test("policy switches gate sharing, and a member override beats the default", async () => {
		await policy(admin, { shareLinks: false, externalInvites: false });
		const link = await owner.json(`/api/projects/${projectId}/links`, "POST", { role: "viewer" });
		assert.equal(link.status, 403);
		assert.match(((await link.json()) as { title: string }).title, /turned off share links/);

		const outside = await owner.json(`/api/projects/${projectId}/invites`, "POST", {
			email: outsider.email,
			role: "viewer"
		});
		assert.equal(outside.status, 403, "outside invites are blocked");
		const inside = await owner.json(`/api/projects/${projectId}/invites`, "POST", {
			email: member.email,
			role: "editor"
		});
		assert.equal(inside.status, 201, "inviting a member is still fine");

		const ownerId = await owner.id();
		const override = await admin.json(`/api/orgs/${orgId}/members/${ownerId}/features`, "PUT", {
			feature: "shareLinks",
			enabled: true
		});
		assert.equal(override.status, 200);
		assert.equal(
			((await override.json()) as { features: { shareLinks: boolean } }).features.shareLinks,
			true
		);
		const allowed = await owner.json(`/api/projects/${projectId}/links`, "POST", {
			role: "viewer"
		});
		assert.equal(allowed.status, 201);

		await admin.json(`/api/orgs/${orgId}/members/${ownerId}/features`, "PUT", {
			feature: "shareLinks",
			enabled: null
		});
		const token = decodeURIComponent(
			((await allowed.json()) as { link: { url: string } }).link.url.split("/").pop() ?? ""
		);
		const redeem = await outsider.json("/api/links/redeem", "POST", { token });
		assert.equal(
			redeem.status,
			403,
			"existing links stop working when the creator loses the feature"
		);
		await policy(admin, { shareLinks: true, externalInvites: true });
	});

	test("admins publish templates and shared packages that every member uses", async () => {
		const put = (c: Client, id: string, path: string, body: string | Uint8Array) =>
			c.request(`/api/projects/${id}/files/raw?path=${encodeURIComponent(path)}`, {
				method: "PUT",
				headers: { "if-none-match": "*" },
				body: typeof body === "string" ? body : new Blob([body as BlobPart])
			});
		assert.equal((await put(owner, projectId, "report.tex", "\\documentclass{lab}")).status, 201);

		const save = (c: Client) =>
			c.json(`/api/orgs/${orgId}/templates/${projectId}`, "PUT", { title: "Lab report" });
		assert.equal((await save(member)).status, 403);
		assert.equal((await save(admin)).status, 204);
		assert.equal((await save(outsider)).status, 404);

		const listed = await member.request(`/api/orgs/${orgId}/templates`);
		const { templates } = (await listed.json()) as { templates: { title: string }[] };
		assert.deepEqual(
			templates.map((t) => t.title),
			["Lab report"]
		);

		// A member with no access to the source project can still start from it.
		await policy(admin, { memberAccess: "none" });
		const used = await member.json(`/api/orgs/${orgId}/templates/${projectId}/use`, "POST", {
			name: "My report"
		});
		assert.equal(used.status, 201, await used.clone().text());
		const copy = ((await used.json()) as { project: { id: string; role: string } }).project;
		assert.equal(copy.role, "owner");
		const text = await member.request(`/api/projects/${copy.id}/files/raw?path=report.tex`);
		assert.equal(await text.text(), "\\documentclass{lab}");
		await policy(admin, { memberAccess: "editor" });

		const empty = await member.request(`/api/orgs/${orgId}/library`);
		assert.deepEqual(await empty.json(), { projectId: null, files: [] });
		assert.equal((await member.json(`/api/orgs/${orgId}/library`, "POST", {})).status, 403);
		const created = await admin.json(`/api/orgs/${orgId}/library`, "POST", {});
		assert.equal(created.status, 201);
		const libId = ((await created.json()) as { projectId: string }).projectId;
		const again = await admin.json(`/api/orgs/${orgId}/library`, "POST", {});
		assert.equal(((await again.json()) as { projectId: string }).projectId, libId);

		assert.equal((await put(admin, libId, "lab.cls", "\\ProvidesClass{lab}")).status, 201);
		const font = new Uint8Array([0, 1, 0, 0, 7]);
		assert.equal((await put(admin, libId, "fonts/lab.otf", font)).status, 201);

		const lib = await member.request(`/api/orgs/${orgId}/library`);
		const { files } = (await lib.json()) as {
			files: { path: string; content: string | null; size: number }[];
		};
		const byPath = Object.fromEntries(files.map((f) => [f.path, f]));
		assert.equal(byPath["lab.cls"]?.content, "\\ProvidesClass{lab}");
		assert.equal(
			byPath["README.txt"]?.size,
			new TextEncoder().encode(byPath["README.txt"]?.content ?? "").byteLength
		);
		const raw = await member.request(`/api/orgs/${orgId}/library/raw?path=fonts/lab.otf`);
		assert.equal(raw.status, 200);
		assert.deepEqual(new Uint8Array(await raw.arrayBuffer()), font);
		assert.equal((await member.request(`/api/orgs/${orgId}/library/raw?path=../x`)).status, 400);
		assert.equal((await outsider.request(`/api/orgs/${orgId}/library`)).status, 404);

		assert.equal(
			(await admin.request(`/api/orgs/${orgId}/templates/${projectId}`, { method: "DELETE" }))
				.status,
			204
		);
	});

	test("requiring two-factor locks out members who have not enrolled", async () => {
		const enroll = async (c: Client) =>
			it.built.deps.db
				.update(user)
				.set({ twoFactorEnabled: true })
				.where(eq(user.id, await c.id()));
		const code = async (res: Response) => ((await res.json()) as { code?: string }).code;

		const early = await policy(admin, { requireTwoFactor: true });
		assert.equal(early.status, 409, "an admin without it can't lock themselves out");
		await enroll(admin);
		assert.equal((await policy(admin, { requireTwoFactor: true })).status, 200);

		const blockedOrg = await member.request(`/api/orgs/${orgId}`);
		assert.equal(blockedOrg.status, 403);
		assert.equal(await code(blockedOrg), "two_factor_required");
		const blockedProject = await member.request(`/api/projects/${projectId}`);
		assert.equal(blockedProject.status, 403);
		assert.equal(await code(blockedProject), "two_factor_required");
		assert.equal((await outsider.request(`/api/projects/${projectId}`)).status, 404);
		assert.equal((await admin.request(`/api/orgs/${orgId}`)).status, 200);

		await enroll(member);
		assert.equal((await member.request(`/api/orgs/${orgId}`)).status, 200);
		assert.equal((await policy(admin, { requireTwoFactor: false })).status, 200);
	});

	test("single sign-on is set up per organization by its admins", async () => {
		const register = (c: Client, body: Record<string, unknown>) =>
			c.json("/api/auth/sso/register", "POST", {
				providerId: `idp-${Date.now().toString(36)}`,
				issuer: "https://idp.example.test",
				domain: "example.test",
				oidcConfig: {
					clientId: "id",
					clientSecret: "secret",
					authorizationEndpoint: "https://idp.example.test/auth",
					tokenEndpoint: "https://idp.example.test/token",
					jwksEndpoint: "https://idp.example.test/jwks",
					skipDiscovery: true
				},
				...body
			});
		assert.equal(
			(await register(admin, {})).status,
			400,
			"a personal provider could capture a domain"
		);
		assert.equal((await register(member, { organizationId: orgId })).status, 403);
		assert.equal((await register(outsider, { organizationId: orgId })).status, 400);
		assert.equal((await member.request(`/api/orgs/${orgId}/sso`)).status, 403);
		const list = await admin.request(`/api/orgs/${orgId}/sso`);
		assert.deepEqual(((await list.json()) as { providers: unknown[] }).providers, []);
	});

	test("a directory provisions and removes members over SCIM", async () => {
		assert.equal((await member.json(`/api/orgs/${orgId}/scim`, "POST", {})).status, 403);
		const created = await admin.json(`/api/orgs/${orgId}/scim`, "POST", { expiresInDays: 30 });
		assert.equal(created.status, 201, await created.clone().text());
		const { token, url } = (await created.json()) as { token: string; url: string };
		assert.match(url, /\/api\/auth\/scim\/v2$/);

		const scim = (path: string, method: string, body?: unknown, bearer = token) =>
			it.app.request(`/api/auth/scim/v2${path}`, {
				method,
				headers: {
					authorization: `Bearer ${bearer}`,
					"content-type": "application/scim+json",
					"x-forwarded-for": "10.9.9.9"
				},
				body: body === undefined ? undefined : JSON.stringify(body)
			});
		assert.equal((await scim("/Users", "GET", undefined, "bogus")).status, 401);

		const email = `scim-${Date.now().toString(36)}@example.test`;
		const made = await scim("/Users", "POST", {
			schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
			userName: email,
			externalId: `ext-${email}`,
			name: { formatted: "Scim Person" },
			emails: [{ value: email, primary: true }],
			active: true
		});
		assert.equal(made.status, 201, await made.clone().text());
		const scimUser = (await made.json()) as { id: string };

		const members = async () => {
			const full = await owner.request(
				`/api/auth/organization/get-full-organization?organizationId=${orgId}`
			);
			return ((await full.json()) as { members: { user: { email: string } }[] }).members.map(
				(m) => m.user.email
			);
		};
		assert.ok((await members()).includes(email), "provisioned into the org");

		const off = await scim(`/Users/${scimUser.id}`, "PATCH", {
			schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
			Operations: [{ op: "replace", path: "active", value: false }]
		});
		assert.equal(off.status, 200, await off.clone().text());
		assert.ok(!(await members()).includes(email), "deprovisioned from the org");

		const list = await admin.request(`/api/orgs/${orgId}/scim`);
		const { connections } = (await list.json()) as { connections: { connectionId: string }[] };
		assert.equal(connections.length, 1);
		const removed = await admin.request(`/api/orgs/${orgId}/scim/${connections[0]?.connectionId}`, {
			method: "DELETE"
		});
		assert.equal(removed.status, 204);
		assert.equal(
			(await scim("/Users", "GET")).status,
			401,
			"a removed connection's token stops working"
		);
	});

	test("removing a member hands their org projects to an owner", async () => {
		const mine = await member.json("/api/projects", "POST", { name: "Member draft", orgId });
		const draftId = ((await mine.json()) as { project: { id: string } }).project.id;
		const full = await owner.request(
			`/api/auth/organization/get-full-organization?organizationId=${orgId}`
		);
		const { members } = (await full.json()) as { members: { id: string; userId: string }[] };
		const memberId = await member.id();
		const row = members.find((m) => m.userId === memberId);
		assert.ok(row);
		const removed = await owner.json("/api/auth/organization/remove-member", "POST", {
			memberIdOrEmail: row.id,
			organizationId: orgId
		});
		assert.equal(removed.status, 200, await removed.clone().text());
		assert.equal(await roleOn(owner, draftId), "owner", "the project stayed with the org");
		assert.equal(await roleOn(member, draftId), 404);
	});

	test("admins read stats and the audit log, as JSON and CSV", async () => {
		assert.equal((await outsider.request(`/api/orgs/${orgId}/audit`)).status, 404);
		const stats = await admin.request(`/api/orgs/${orgId}/stats`);
		const { stats: s } = (await stats.json()) as { stats: { members: number; projects: number } };
		assert.equal(s.members, 2);
		assert.equal(s.projects, 4, "thesis, member draft, template copy, shared packages");

		const res = await admin.request(`/api/orgs/${orgId}/audit?limit=100`);
		const { events } = (await res.json()) as { events: { action: string }[] };
		const actions = new Set(events.map((e) => e.action));
		for (const a of [
			"org.created",
			"invitation.created",
			"invitation.accepted",
			"policy.updated",
			"project.created",
			"project.link_created",
			"member.feature_changed",
			"member.removed"
		]) {
			assert.ok(actions.has(a), `audit has ${a}`);
		}
		const csv = await admin.request(`/api/orgs/${orgId}/audit.csv`);
		assert.equal(csv.headers.get("content-type"), "text/csv; charset=utf-8");
		const text = await csv.text();
		assert.ok(text.startsWith("time,actor,actor_email,action"));
		assert.ok(text.includes("policy.updated"));
	});

	test("the last owner can't delete their account while others remain", async () => {
		const res = await owner.json("/api/auth/delete-user", "POST", {});
		assert.notEqual(res.status, 200);
		assert.match(
			((await res.json()) as { message: string }).message,
			/Make someone else an owner of "Physics Lab"/
		);
	});

	test("deleting the org removes its projects", async () => {
		const res = await owner.json("/api/auth/organization/delete", "POST", {
			organizationId: orgId
		});
		assert.equal(res.status, 200, await res.clone().text());
		assert.equal(await roleOn(owner, projectId), 404);
		assert.equal((await admin.request(`/api/orgs/${orgId}`)).status, 404);
		await it.drainJobs();
	});
});
