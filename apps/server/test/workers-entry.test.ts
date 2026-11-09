import assert from "node:assert/strict";
import { describe, test } from "node:test";
import worker from "../src/entry/workers.ts";

// What `wrangler.jsonc` gives the deployed Worker, with fakes for the bindings.
const kv = { get: async () => null, put: async () => {}, delete: async () => {} };
const queue = { send: async () => {} };
const limiter = { limit: async () => ({ success: true }) };
const base = {
	PUBLIC_URL: "https://api.example.test",
	APP_URL: "https://app.example.test",
	WEB_ORIGINS: "https://app.example.test",
	BETTER_AUTH_SECRET: "x".repeat(40),
	QUEUE_DRIVER: "cloudflare",
	CLIENT_IP_HEADER: "cf-connecting-ip",
	HYPERDRIVE: { connectionString: "postgres://u:p@127.0.0.1:1/db" },
	CACHE: kv,
	JOBS: queue,
	API_RATE_LIMITER: limiter,
	SHARE_RATE_LIMITER: limiter
};

// A fresh object per case: adapters are cached per env object.
const call = (env: Record<string, unknown>) =>
	worker.fetch(new Request("https://api.example.test/healthz"), env, {
		waitUntil() {},
		passThroughOnException() {}
	} as never);

describe("the Workers entry starts with whatever is configured", () => {
	test("mail via Cloudflare without the send_email binding runs with mail off", async () => {
		const res = await call({ ...base, MAIL_DRIVER: "cloudflare" });
		assert.equal(res.status, 200);
	});

	test("mail via Cloudflare with the binding starts", async () => {
		const res = await call({
			...base,
			MAIL_DRIVER: "cloudflare",
			EMAIL: { send: async () => ({ messageId: "m" }) }
		});
		assert.equal(res.status, 200);
	});

	test("r2 storage without its bucket binding runs with storage off", async () => {
		const res = await call({ ...base, BLOB_DRIVER: "r2" });
		assert.equal(res.status, 200);
	});

	test("s3 storage without credentials runs with storage off", async () => {
		const res = await call({ ...base, BLOB_DRIVER: "s3" });
		assert.equal(res.status, 200);
	});

	test("nothing configured at all still starts", async () => {
		assert.equal((await call({ ...base })).status, 200);
	});
});
