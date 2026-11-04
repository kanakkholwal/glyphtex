import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
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
		assert.equal(s.projects, 2);

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
