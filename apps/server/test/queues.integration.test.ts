import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Redis } from "ioredis";
import { connectRabbit, rabbitQueue } from "../src/adapters/rabbitmq/queue.ts";
import { redisQueue } from "../src/adapters/redis/index.ts";
import type { Mail, Mailer } from "../src/adapters/types.ts";
import type { JobDeps } from "../src/jobs/handlers.ts";
import { redisConsumer, startRabbitConsumer } from "../src/jobs/consumers.ts";
import { createLogger } from "../src/lib/logger.ts";

const enabled = process.env.GLYPHTEX_IT === "1";
const logger = createLogger({ test: "queues" });

/** Records deliveries; fails the first `failures` sends to exercise the retry path. */
function recordingMailer(failures = 0) {
	const sent: Mail[] = [];
	let left = failures;
	const mailer: Mailer = {
		async send(mail) {
			if (left-- > 0) throw new Error("transient");
			sent.push(mail);
		}
	};
	return { sent, mailer };
}

const deps = (mailer: Mailer) => ({ mailer, logger }) as unknown as JobDeps;
const mail = (to: string): Mail => ({ to, subject: "s", text: "t", html: "<p>t</p>" });

async function waitFor(check: () => boolean, ms = 15_000) {
	const start = Date.now();
	while (!check()) {
		if (Date.now() - start > ms) throw new Error("timed out waiting for delivery");
		await new Promise((r) => setTimeout(r, 100));
	}
}

describe("redis queue", { skip: enabled ? false : "set GLYPHTEX_IT=1" }, () => {
	test("delivers, retries a failure via the delayed set, then succeeds", async () => {
		const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6380/14");
		const blocking = redis.duplicate();
		try {
			const { sent, mailer } = recordingMailer(1);
			const consumer = redisConsumer(redis, blocking, deps(mailer));
			await redisQueue(redis).enqueue({ type: "email.send", mail: mail("r@example.test") });
			while (await consumer.processOne(1)) {}
			assert.equal(sent.length, 0, "first attempt failed");
			assert.equal(await consumer.promoteDue(Number.POSITIVE_INFINITY), 1);
			while (await consumer.processOne(1)) {}
			assert.deepEqual(
				sent.map((m) => m.to),
				["r@example.test"]
			);
		} finally {
			blocking.disconnect();
			redis.disconnect();
		}
	});
});

describe("rabbitmq queue", {
	skip: enabled && process.env.RABBITMQ_URL ? false : "set GLYPHTEX_IT=1 and RABBITMQ_URL"
}, () => {
	test("delivers through the work queue and retries through the delay queue", async () => {
		const url = process.env.RABBITMQ_URL as string;
		const { connection, channel } = await connectRabbit(url);
		const { sent, mailer } = recordingMailer(1);
		const stop = await startRabbitConsumer(url, deps(mailer), logger);
		try {
			await rabbitQueue(channel).enqueue({ type: "email.send", mail: mail("a@example.test") });
			await rabbitQueue(channel).enqueue(
				{ type: "email.send", mail: mail("b@example.test") },
				{ delaySeconds: 1 }
			);
			// The first delivery fails once and comes back after its backoff delay.
			await waitFor(() => sent.length === 2, 30_000);
			assert.deepEqual(sent.map((m) => m.to).sort(), ["a@example.test", "b@example.test"]);
		} finally {
			await stop();
			await connection.close();
		}
	});
});
