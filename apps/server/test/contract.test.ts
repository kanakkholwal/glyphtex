import assert from "node:assert/strict";
import { test } from "node:test";
import type * as Contract from "../src/contract.ts";
import type { MembersResponse } from "../src/contract.ts";
import type { fileMeta } from "../src/services/files.ts";
import type { projectService } from "../src/services/projects.ts";
import type { orgContentService } from "../src/services/org-content.ts";
import type { orgService } from "../src/services/orgs.ts";
import type { sharingService } from "../src/services/sharing.ts";

/** What JSON.stringify turns a server value into: Dates become strings. */
type Wire<T> = T extends Date
	? string
	: T extends (infer U)[]
		? Wire<U>[]
		: T extends object
			? { [K in keyof T]: Wire<T[K]> }
			: T;
type Service<F extends (...a: never[]) => unknown> = ReturnType<F>;
type Resolved<T> = Wire<Awaited<T>>;

// Compile-time lockstep: tsc fails here when a service result drifts from the contract.
type Projects = Service<typeof projectService>;
type Sharing = Service<typeof sharingService>;
type Orgs = Service<typeof orgService>;
type OrgContent = Service<typeof orgContentService>;
const checks = {
	view: null as unknown as Resolved<ReturnType<Projects["view"]>> satisfies Contract.ProjectView,
	list: null as unknown as Resolved<
		ReturnType<Projects["list"]>
	> satisfies Contract.ProjectSummary[],
	file: null as unknown as Resolved<ReturnType<typeof fileMeta>> satisfies Contract.FileMeta,
	members: null as unknown as Resolved<ReturnType<Sharing["members"]>> satisfies MembersResponse,
	invites: null as unknown as Resolved<
		ReturnType<Sharing["listInvites"]>
	> satisfies Contract.Invite[],
	links: null as unknown as Resolved<
		ReturnType<Sharing["listLinks"]>
	> satisfies Contract.ShareLink[],
	joined: null as unknown as Resolved<ReturnType<Sharing["redeemLink"]>> satisfies Contract.Joined,
	orgView: null as unknown as Resolved<ReturnType<Orgs["view"]>> satisfies Contract.OrgView,
	orgStats: null as unknown as Resolved<ReturnType<Orgs["stats"]>> satisfies Contract.OrgStats,
	audit: null as unknown as Resolved<ReturnType<Orgs["audit"]>> satisfies Contract.AuditEvent[],
	features: null as unknown as Resolved<
		ReturnType<Orgs["memberFeatures"]>
	> satisfies Contract.MemberFeatures,
	orgProjects: null as unknown as Resolved<
		ReturnType<Orgs["projects"]>
	> satisfies Contract.ProjectSummary[],
	templates: null as unknown as Resolved<
		ReturnType<OrgContent["listTemplates"]>
	> satisfies Contract.OrgTemplate[],
	fromTemplate: null as unknown as Resolved<
		ReturnType<OrgContent["useTemplate"]>
	> satisfies Contract.ProjectSummary,
	library: null as unknown as Resolved<
		ReturnType<OrgContent["library"]>
	> satisfies Contract.OrgLibrary
};

test("service results match the wire contract (checked by tsc)", () => {
	assert.equal(Object.keys(checks).length, 15);
});
