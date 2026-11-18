import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { disabledBlobs } from "../src/adapters/blobs/disabled.ts";
import { createApp } from "../src/app.ts";
import { parseConfig } from "../src/config.ts";
import type { Deps } from "../src/context.ts";
import { buildInfo } from "../src/lib/build.ts";
import { createLogger } from "../src/lib/logger.ts";

const base = {
	PUBLIC_URL: "http://localhost:8787",
	APP_URL: "http://localhost:5173",
	BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123"
};

function infoFor(env: Record<string, string>, extra: Partial<Deps> = {}) {
	const config = parseConfig({ ...base, ...env });
	const deps = {
		config,
		db: {},
		adapters: { blobs: disabledBlobs() },
		auth: {},
		logger: createLogger({}, "error"),
		build: buildInfo("node", config),
		...extra
	} as unknown as Deps;
	const app = createApp(() => ({ deps }));
	return Promise.resolve(app.request("/api/public/info")).then(
		(r) => r.json() as Promise<Record<string, unknown>>
	);
}

describe("optional integrations never block startup", () => {
	test("no OAuth apps at all: the server parses its config and Git sync is off", async () => {
		const info = await infoFor({});
		assert.deepEqual(info.gitProviders, []);
		assert.deepEqual(info.providers, []);
	});

	test("each host appears only when its own credentials are set", async () => {
		assert.deepEqual(
			(await infoFor({ GITHUB_CLIENT_ID: "a", GITHUB_CLIENT_SECRET: "b" })).gitProviders,
			["github"]
		);
		assert.deepEqual(
			(await infoFor({ BITBUCKET_CLIENT_ID: "a", BITBUCKET_CLIENT_SECRET: "b" })).gitProviders,
			["bitbucket"]
		);
		// An id without its secret is treated as not configured, not as an error.
		assert.deepEqual((await infoFor({ GITLAB_CLIENT_ID: "a" })).gitProviders, []);
	});

	test("all three hosts together", async () => {
		const info = await infoFor({
			GITHUB_CLIENT_ID: "a",
			GITHUB_CLIENT_SECRET: "b",
			GITLAB_CLIENT_ID: "a",
			GITLAB_CLIENT_SECRET: "b",
			BITBUCKET_CLIENT_ID: "a",
			BITBUCKET_CLIENT_SECRET: "b"
		});
		assert.deepEqual(info.gitProviders, ["github", "gitlab", "bitbucket"]);
	});

	test("sign-in providers do not list Bitbucket, which is link-only", async () => {
		const info = await infoFor({ BITBUCKET_CLIENT_ID: "a", BITBUCKET_CLIENT_SECRET: "b" });
		assert.deepEqual(info.providers, []);
	});
});

describe("the info endpoint", () => {
	test("reports build details, features and live limits", async () => {
		const info = (await infoFor({ GIT_COMMIT: "abc123" })) as {
			name: string;
			commit: string | null;
			features: Record<string, boolean>;
			limits: { live: { maxEditors: number } };
		};
		assert.equal(info.name, "glyphtex-server");
		assert.equal(info.commit, "abc123");
		assert.equal(info.features.live, false, "no realtime host was given");
		assert.equal(typeof info.features.mail, "boolean");
		assert.equal(info.limits.live.maxEditors, 10);
	});

	test("live limits follow their settings", async () => {
		const info = (await infoFor({ LIVE_MAX_EDITORS: "3", LIVE_IDLE_SECONDS: "60" })) as {
			limits: { live: { maxEditors: number; idleSeconds: number } };
		};
		assert.deepEqual([info.limits.live.maxEditors, info.limits.live.idleSeconds], [3, 60]);
	});

	test("an invalid live limit is reported at startup, not silently accepted", () => {
		assert.throws(() => parseConfig({ ...base, LIVE_MAX_EDITORS: "0" }), /LIVE_MAX_EDITORS/);
	});
});
