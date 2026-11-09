import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PROJECT_ROLES, type ProjectRole } from "../src/db/schema.ts";
import {
	can,
	capabilities,
	PROJECT_PERMISSIONS,
	type ProjectPermission,
	strongerRole
} from "../src/rbac/permissions.ts";

const EXPECTED: Record<ProjectRole, ProjectPermission[]> = {
	viewer: ["project:read"],
	commenter: ["project:read", "project:comment"],
	editor: ["project:read", "project:comment", "project:write", "project:rename"],
	owner: [...PROJECT_PERMISSIONS]
};

describe("role x permission matrix", () => {
	for (const role of PROJECT_ROLES) {
		for (const permission of PROJECT_PERMISSIONS) {
			const allowed = EXPECTED[role].includes(permission);
			test(`${role} ${allowed ? "may" : "may not"} ${permission}`, () => {
				assert.equal(can(role, permission), allowed);
			});
		}
	}

	test("no role denies by default", () => {
		for (const permission of PROJECT_PERMISSIONS) assert.equal(can(null, permission), false);
	});

	test("only the owner can share or delete", () => {
		for (const role of PROJECT_ROLES) {
			assert.equal(can(role, "project:share"), role === "owner");
			assert.equal(can(role, "project:delete"), role === "owner");
		}
	});

	test("capabilities mirror the grant table", () => {
		for (const role of PROJECT_ROLES)
			assert.deepEqual(capabilities(role).sort(), EXPECTED[role].sort());
	});
});

test("strongerRole never downgrades", () => {
	assert.equal(strongerRole("editor", "viewer"), "editor");
	assert.equal(strongerRole("viewer", "commenter"), "commenter");
	assert.equal(strongerRole("owner", "editor"), "owner");
});
