import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { orcidProvider, orcidUser } from "../src/auth/orcid.ts";
import { parseConfig } from "../src/config.ts";

const base = {
	PUBLIC_URL: "http://localhost:8787",
	APP_URL: "http://localhost:5173",
	BETTER_AUTH_SECRET: "x".repeat(40)
};

describe("ORCID sign-in", () => {
	test("an account needs no email from ORCID", () => {
		const user = orcidUser({ sub: "0000-0002-1825-0097", name: "Josiah Carberry" });
		assert.equal(user?.id, "0000-0002-1825-0097");
		assert.equal(user?.name, "Josiah Carberry");
		assert.equal(user?.email, "0000-0002-1825-0097@orcid.invalid");
		assert.equal(user?.emailVerified, false);
	});

	test("a private name falls back to given and family name, then to the iD", () => {
		assert.equal(orcidUser({ sub: "a", given_name: "Ada", family_name: "L" })?.name, "Ada L");
		assert.equal(orcidUser({ sub: "0000-0001-0000-0000" })?.name, "0000-0001-0000-0000");
		assert.equal(orcidUser({}), null, "no iD, no account");
	});

	test("it follows what ORCID supports", () => {
		const p = orcidProvider({ clientId: "APP-1", clientSecret: "s", sandbox: false });
		assert.equal(p.discoveryUrl, "https://orcid.org/.well-known/openid-configuration");
		assert.deepEqual(p.scopes, ["openid"]);
		assert.equal(p.authentication, "post");
		assert.equal(p.pkce, false);
		const sandbox = orcidProvider({ clientId: "APP-1", clientSecret: "s", sandbox: true });
		assert.match(sandbox.discoveryUrl ?? "", /^https:\/\/sandbox\.orcid\.org\//);
	});

	test("it turns on only when both credentials are set", () => {
		assert.equal(parseConfig({ ...base, ORCID_CLIENT_ID: "APP-1" }).oauth.orcid, undefined);
		const on = parseConfig({ ...base, ORCID_CLIENT_ID: "APP-1", ORCID_CLIENT_SECRET: "s" });
		assert.deepEqual(on.oauth.orcid, { clientId: "APP-1", clientSecret: "s" });
		assert.equal(on.oauth.orcidSandbox, false);
	});
});
