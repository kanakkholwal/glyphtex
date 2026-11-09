import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cloudflareMailer, parseSender } from "../src/adapters/mail/cloudflare.ts";
import { PermanentMailError } from "../src/adapters/mail/errors.ts";
import { disabledBlobs } from "../src/adapters/blobs/disabled.ts";
import { configNotes, parseConfig } from "../src/config.ts";
import { runJob } from "../src/jobs/handlers.ts";

const base = {
	PUBLIC_URL: "http://localhost:8787",
	APP_URL: "http://localhost:5173",
	BETTER_AUTH_SECRET: "x".repeat(40)
};
const mail = { to: "a@example.test", subject: "Hi", text: "Hi", html: "<p>Hi</p>" };

describe("optional features", () => {
	test("file storage and mail are off until configured", () => {
		const config = parseConfig(base);
		assert.equal(config.blobsEnabled, false);
		assert.equal(config.mailEnabled, false);
		assert.equal(config.requireEmailVerification, false, "can't require a link that can't be sent");
		assert.equal(config.emailVerificationSuspended, true);
		assert.equal(configNotes(config).length, 3);
	});

	test("s3 without its credentials falls back to storage off", () => {
		const half = parseConfig({ ...base, BLOB_DRIVER: "s3", S3_BUCKET: "glyphtex" });
		assert.equal(half.blobsEnabled, false);
		assert.equal(half.blobsFellBack, true);
		assert.match(configNotes(half).join(" "), /S3_\* settings are incomplete/);

		const full = parseConfig({
			...base,
			BLOB_DRIVER: "s3",
			S3_ENDPOINT: "https://storage.example.test",
			S3_BUCKET: "glyphtex",
			S3_ACCESS_KEY_ID: "id",
			S3_SECRET_ACCESS_KEY: "secret"
		});
		assert.equal(full.blobsEnabled, true);
		assert.equal(full.blobsFellBack, false);
	});

	test("the mail driver is inferred from the credentials present", () => {
		assert.equal(parseConfig({ ...base, RESEND_API_KEY: "re_x" }).mailDriver, "resend");
		assert.equal(parseConfig({ ...base, SMTP_URL: "smtp://localhost:1025" }).mailDriver, "smtp");
		const cf = parseConfig({ ...base, MAIL_DRIVER: "cloudflare" });
		assert.equal(cf.mailEnabled, true);
		assert.equal(cf.requireEmailVerification, true);
		assert.equal(parseConfig({ ...base, BLOB_DRIVER: "r2" }).blobsEnabled, true);
	});

	test("disabled storage refuses writes with a code the client can branch on", async () => {
		const blobs = disabledBlobs();
		await assert.rejects(blobs.put("k", new Uint8Array([1])), {
			code: "storage_disabled",
			status: 501
		});
		assert.equal(await blobs.get("k"), null);
		await blobs.delete(["k"]);
	});

	test("senders parse into the binding's object form", () => {
		assert.deepEqual(parseSender("GlyphTeX <no-reply@example.test>"), {
			email: "no-reply@example.test",
			name: "GlyphTeX"
		});
		assert.equal(parseSender("no-reply@example.test"), "no-reply@example.test");
	});

	test("the Cloudflare mailer retries transient failures only", async () => {
		let calls = 0;
		const flaky = cloudflareMailer(
			{
				async send() {
					calls++;
					if (calls === 1) throw Object.assign(new Error("later"), { code: "E_DELIVERY_FAILED" });
					return { messageId: "m1" };
				}
			},
			"GlyphTeX <no-reply@example.test>"
		);
		await flaky.send(mail);
		assert.equal(calls, 2);

		let refused = 0;
		const blocked = cloudflareMailer(
			{
				async send() {
					refused++;
					throw Object.assign(new Error("not allowed"), { code: "E_RECIPIENT_NOT_ALLOWED" });
				}
			},
			"no-reply@example.test"
		);
		await assert.rejects(blocked.send(mail), PermanentMailError);
		assert.equal(refused, 1, "a permanent refusal is not retried");
	});

	test("a permanently refused email ends its job instead of retrying it forever", async () => {
		const logged: string[] = [];
		const deps = {
			db: {} as never,
			blobs: disabledBlobs(),
			logger: { error: (m: string) => logged.push(m) } as never,
			mailer: {
				async send() {
					throw new PermanentMailError("recipient not allowed");
				}
			}
		};
		await runJob({ type: "email.send", mail }, deps);
		assert.deepEqual(logged, ["email dropped"]);
	});
});
