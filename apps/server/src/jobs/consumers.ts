import type amqp from "amqplib";
import type { Redis } from "ioredis";
import {
	assertTopology,
	publish,
	RABBIT_DEAD_QUEUE,
	RABBIT_QUEUE
} from "../adapters/rabbitmq/queue.ts";
import { DEAD_KEY, DELAYED_KEY, JOBS_KEY, type QueuedJob } from "../adapters/redis/index.ts";
import type { Logger } from "../lib/logger.ts";
import { backoffDelay } from "../lib/resilience.ts";
import { type JobDeps, runJob } from "./handlers.ts";
import { MAX_JOB_ATTEMPTS, parseJob } from "./types.ts";

type Outcome = { ok: true } | { ok: false; dead: true } | { ok: false; dead: false; delay: number };

/** Runs one delivery and decides its fate: done, retry after backoff, or dead-letter. */
export async function attemptJob(queued: QueuedJob, deps: JobDeps): Promise<Outcome> {
	try {
		await runJob(parseJob(queued.job), deps);
		return { ok: true };
	} catch (error) {
		deps.logger.error("job failed", { error, attempts: queued.attempts + 1 });
		if (queued.attempts + 1 >= MAX_JOB_ATTEMPTS) return { ok: false, dead: true };
		return { ok: false, dead: false, delay: Math.ceil(backoffDelay(queued.attempts, 5, 600)) };
	}
}

const next = (q: QueuedJob): QueuedJob => ({ job: q.job, attempts: q.attempts + 1 });

/** Reliable Redis queue: BRPOPLPUSH into a processing list, removed only after handling. */
export function redisConsumer(redis: Redis, blocking: Redis, deps: JobDeps) {
	const PROCESSING = `${JOBS_KEY}:processing`;
	return {
		/** Jobs stranded by a crash mid-run go back on the queue. */
		async recover() {
			while ((await redis.rpoplpush(PROCESSING, JOBS_KEY)) !== null) {}
		},

		async promoteDue(now = Date.now()) {
			const due = await redis.zrangebyscore(DELAYED_KEY, 0, now, "LIMIT", 0, 100);
			for (const payload of due) {
				if (await redis.zrem(DELAYED_KEY, payload)) await redis.lpush(JOBS_KEY, payload);
			}
			return due.length;
		},

		/** Handles one job; false when none arrived within `timeoutSeconds`. */
		async processOne(timeoutSeconds = 5) {
			const payload = await blocking.brpoplpush(JOBS_KEY, PROCESSING, timeoutSeconds);
			if (!payload) return false;
			const queued = JSON.parse(payload) as QueuedJob;
			const outcome = await attemptJob(queued, deps);
			if (!outcome.ok) {
				const retry = JSON.stringify(next(queued));
				if (outcome.dead) await redis.lpush(DEAD_KEY, retry);
				else await redis.zadd(DELAYED_KEY, Date.now() + outcome.delay * 1000, retry);
			}
			await redis.lrem(PROCESSING, 1, payload);
			return true;
		}
	};
}

export async function startRabbitConsumer(url: string, deps: JobDeps, logger: Logger) {
	const { default: amqplib } = await import("amqplib");
	const connection = await amqplib.connect(url);
	const channel: amqp.ConfirmChannel = await connection.createConfirmChannel();
	await assertTopology(channel);
	await channel.prefetch(8);
	await channel.consume(RABBIT_QUEUE, async (msg) => {
		if (!msg) return;
		try {
			const queued = JSON.parse(msg.content.toString()) as QueuedJob;
			const outcome = await attemptJob(queued, deps);
			if (!outcome.ok) {
				if (outcome.dead) {
					channel.sendToQueue(RABBIT_DEAD_QUEUE, Buffer.from(JSON.stringify(next(queued))), {
						persistent: true
					});
				} else {
					await publish(channel, next(queued), outcome.delay);
				}
			}
			channel.ack(msg);
		} catch (error) {
			// Malformed payload or a failed republish: requeue once, then let it dead-letter.
			logger.error("rabbit delivery failed", { error });
			channel.nack(msg, false, !msg.fields.redelivered);
		}
	});
	return () => connection.close();
}
