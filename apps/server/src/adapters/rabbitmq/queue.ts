import amqp from "amqplib";
import { createPolicy } from "../../lib/resilience.ts";
import type { Queue } from "../types.ts";

export const RABBIT_QUEUE = "glyphtex.jobs";
export const RABBIT_DELAY_QUEUE = "glyphtex.jobs.delay";
export const RABBIT_DEAD_QUEUE = "glyphtex.jobs.dead";

/** Declares the work, delay (TTL then dead-letters into work) and dead queues. Idempotent. */
export async function assertTopology(channel: amqp.Channel) {
	await channel.assertQueue(RABBIT_QUEUE, { durable: true });
	await channel.assertQueue(RABBIT_DEAD_QUEUE, { durable: true });
	await channel.assertQueue(RABBIT_DELAY_QUEUE, {
		durable: true,
		deadLetterExchange: "",
		deadLetterRoutingKey: RABBIT_QUEUE
	});
}

export async function connectRabbit(url: string) {
	const connection = await amqp.connect(url);
	const channel = await connection.createConfirmChannel();
	await assertTopology(channel);
	return { connection, channel };
}

export function publish(channel: amqp.ConfirmChannel, payload: unknown, delaySeconds?: number) {
	const body = Buffer.from(JSON.stringify(payload));
	const queue = delaySeconds ? RABBIT_DELAY_QUEUE : RABBIT_QUEUE;
	return new Promise<void>((resolve, reject) => {
		channel.sendToQueue(
			queue,
			body,
			{
				persistent: true,
				contentType: "application/json",
				...(delaySeconds ? { expiration: String(delaySeconds * 1000) } : {})
			},
			(err) => (err ? reject(err) : resolve())
		);
	});
}

export function rabbitQueue(channel: amqp.ConfirmChannel): Queue {
	const policy = createPolicy("Job queue", { timeoutMs: 5_000 });
	return {
		async enqueue(job, options) {
			await policy.run(() => publish(channel, { job, attempts: 0 }, options?.delaySeconds));
		}
	};
}
