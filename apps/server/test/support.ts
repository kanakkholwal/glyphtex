import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { waitReady } from "../src/adapters/redis/index.ts";
import { createApp } from "../src/app.ts";
import { buildNodeDeps } from "../src/entry/node-deps.ts";
import { redisConsumer } from "../src/jobs/consumers.ts";

export const integrationEnabled = process.env.GLYPHTEX_IT === "1";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8026";
export const APP_URL = "http://localhost:5173";

/** Real Postgres, Valkey, S3 and Mailpit from compose.yaml, with jobs drained on demand. */
export async function startIntegration() {
	const built = await buildNodeDeps({
		PUBLIC_URL: "http://localhost:8787",
		APP_URL,
		BETTER_AUTH_SECRET: "integration-secret-integration-secret-0123",
		DATABASE_URL:
			process.env.DATABASE_URL ?? "postgres://glyphtex:glyphtex@localhost:5433/glyphtex",
		REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6380",
		BLOB_DRIVER: "s3",
		S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:9002",
		S3_REGION: "us-east-1",
		S3_BUCKET: "glyphtex",
		S3_ACCESS_KEY_ID: "glyphtex",
		S3_SECRET_ACCESS_KEY: "glyphtex-secret",
		MAIL_DRIVER: "smtp",
		SMTP_URL: process.env.SMTP_URL ?? "smtp://localhost:1025",
		API_RATE_LIMIT: "10000"
	});
	await migrate(built.deps.db, {
		migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url))
	});
	const app = createApp(() => ({ deps: built.deps }));
	const blocking = built.redis.duplicate();
	await waitReady(blocking);
	const consumer = redisConsumer(built.redis, blocking, {
		db: built.deps.db,
		blobs: built.deps.adapters.blobs,
		mailer: built.deps.adapters.mailer,
		logger: built.deps.logger
	});

	/** Runs every queued job, including delayed ones, as the worker eventually would. */
	async function drainJobs() {
		await consumer.promoteDue(Number.POSITIVE_INFINITY);
		while (await consumer.processOne(1)) {}
	}

	async function latestLink(to: string, pathPart: string) {
		await drainJobs();
		const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
		const { messages } = (await search.json()) as { messages: { ID: string }[] };
		for (const m of messages) {
			const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as {
				Text: string;
			};
			const url = msg.Text.match(/https?:\/\/\S+/g)?.find((u) => u.includes(pathPart));
			if (url) return new URL(url);
		}
		throw new Error(`no email to ${to} containing ${pathPart}`);
	}

	let clients = 0;
	const run = Date.now().toString(36);

	/** One browser: its own cookie jar and client IP. */
	class Client {
		cookies = new Map<string, string>();
		email: string;
		// Distinct client IPs, so Better Auth's per-IP auth limits apply per test user.
		ip = `10.0.${Math.floor(clients / 250)}.${(clients++ % 250) + 1}`;
		constructor(name: string) {
			this.email = `${name}-${run}@example.test`;
		}
		async request(path: string, init: RequestInit = {}) {
			const headers = new Headers(init.headers);
			headers.set("origin", APP_URL);
			headers.set("x-forwarded-for", this.ip);
			if (this.cookies.size) {
				headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
			}
			const res = await app.request(path, { ...init, headers });
			for (const c of res.headers.getSetCookie()) {
				const [pair] = c.split(";");
				const [k, ...v] = (pair ?? "").split("=");
				if (k) this.cookies.set(k.trim(), v.join("="));
			}
			return res;
		}
		json(path: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
			return this.request(path, {
				method,
				headers: { "content-type": "application/json", ...headers },
				body: body === undefined ? undefined : JSON.stringify(body)
			});
		}
		async signUp() {
			const res = await this.json("/api/auth/sign-up/email", "POST", {
				email: this.email,
				password: "correct horse battery",
				name: this.email.split("@")[0]
			});
			assert.equal(res.status, 200, await res.clone().text());
			const verify = await latestLink(this.email, "verify-email");
			const done = await this.request(`${verify.pathname}${verify.search}`);
			assert.ok([200, 302].includes(done.status), `verify returned ${done.status}`);
			assert.equal((await this.request("/api/me")).status, 200, "auto sign-in after verification");
			return this;
		}
		async id() {
			return ((await (await this.request("/api/me")).json()) as { user: { id: string } }).user.id;
		}
	}

	return {
		app,
		built,
		Client,
		drainJobs,
		latestLink,
		async stop() {
			blocking.disconnect();
			await built.close();
		}
	};
}

export type Integration = Awaited<ReturnType<typeof startIntegration>>;
