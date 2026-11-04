import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ORG_ROLES } from "../src/db/schema.ts";
import {
	canOrg,
	DEFAULT_POLICY,
	ORG_PERMISSIONS,
	type OrgPermission,
	resolveFeatures,
	roleFromOrg
} from "../src/rbac/org.ts";

const EXPECTED: Record<(typeof ORG_ROLES)[number], OrgPermission[]> = {
	member: ["org:read", "org:create-project"],
	admin: [
		"org:read",
		"org:create-project",
		"org:manage-members",
		"org:manage-policy",
		"org:read-audit"
	],
	owner: [...ORG_PERMISSIONS]
};

describe("org role x permission matrix", () => {
	for (const role of ORG_ROLES) {
		for (const permission of ORG_PERMISSIONS) {
			const allowed = EXPECTED[role].includes(permission);
			test(`${role} ${allowed ? "may" : "may not"} ${permission}`, () => {
				assert.equal(canOrg(role, permission), allowed);
			});
		}
	}
	test("non-members and unknown roles", () => {
		assert.equal(canOrg(null, "org:read"), false);
		assert.equal(canOrg("custom-role", "org:read"), true);
		assert.equal(canOrg("custom-role", "org:manage-policy"), false);
	});
});

test("org roles map onto project roles through the policy", () => {
	assert.equal(roleFromOrg("owner", DEFAULT_POLICY), "owner");
	assert.equal(roleFromOrg("admin", { ...DEFAULT_POLICY, memberAccess: "none" }), "owner");
	assert.equal(roleFromOrg("member", DEFAULT_POLICY), "editor");
	assert.equal(roleFromOrg("member", { ...DEFAULT_POLICY, memberAccess: "viewer" }), "viewer");
	assert.equal(roleFromOrg("member", { ...DEFAULT_POLICY, memberAccess: "none" }), null);
});

test("a member override beats the org default", () => {
	const policy = { ...DEFAULT_POLICY, ai: false, shareLinks: true };
	assert.deepEqual(resolveFeatures(policy, []), {
		ai: false,
		shareLinks: true,
		externalInvites: true
	});
	assert.deepEqual(
		resolveFeatures(policy, [
			{ feature: "ai", enabled: true },
			{ feature: "shareLinks", enabled: false }
		]),
		{ ai: true, shareLinks: false, externalInvites: true }
	);
});
