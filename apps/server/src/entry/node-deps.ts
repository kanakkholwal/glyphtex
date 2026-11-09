import { disabledBlobs } from "../adapters/blobs/disabled.ts";
import { noMailer } from "../adapters/mail/none.ts";
import { smtpMailer } from "../adapters/mail/smtp.ts";
import { resendMailer } from "../adapters/mail/resend.ts";
import { connectRabbit, rabbitQueue } from "../adapters/rabbitmq/queue.ts";
import { connectRedis, redisCache, redisQueue, redisRateLimiter } from "../adapters/redis/index.ts";
import { s3Blobs } from "../adapters/s3/blobs.ts";
import type { Adapters, Mailer } from "../adapters/types.ts";
import { createAuth } from "../auth/auth.ts";
import { type Config, configNotes, parseConfig, required } from "../config.ts";
import type { Deps } from "../context.ts";
import { connectDb } from "../db/client.ts";
import { createLogger } from "../lib/logger.ts";

/** Composition root for Node/Bun: one set of long-lived connections per process. */
export async function buildNodeDeps(env: Record<string, unknown> = process.env) {
	const config = parseConfig(env);
	const logger = createLogger({ runtime: "node" });
	for (const note of configNotes(config)) logger.warn(note);
	const redis = await connectRedis(required(config.redisUrl, "REDIS_URL"));
	const { db, close: closeDb } = connectDb(required(config.databaseUrl, "DATABASE_URL"));
	const closers: (() => Promise<unknown>)[] = [closeDb, () => redis.quit()];

	let queue: Adapters["queue"];
	if (config.queueDriver === "rabbitmq") {
		const rabbit = await connectRabbit(required(config.rabbitmqUrl, "RABBITMQ_URL"));
		queue = rabbitQueue(rabbit.channel);
		closers.push(() => rabbit.connection.close());
	} else {
		queue = redisQueue(redis);
	}

	if (config.blobDriver === "r2") {
		throw new Error(
			"BLOB_DRIVER=r2 needs the Workers runtime; use s3 with R2's S3 endpoint instead."
		);
	}
	if (config.mailDriver === "cloudflare") {
		throw new Error("MAIL_DRIVER=cloudflare needs the Workers runtime; use smtp or resend here.");
	}

	const adapters: Adapters = {
		cache: redisCache(redis),
		queue,
		blobs: config.blobsEnabled
			? s3Blobs({
					endpoint: required(config.s3.endpoint, "S3_ENDPOINT"),
					region: config.s3.region,
					bucket: required(config.s3.bucket, "S3_BUCKET"),
					accessKeyId: required(config.s3.accessKeyId, "S3_ACCESS_KEY_ID"),
					secretAccessKey: required(config.s3.secretAccessKey, "S3_SECRET_ACCESS_KEY")
				})
			: disabledBlobs(),
		mailer: buildMailer(config),
		rateLimiter: redisRateLimiter(redis, {
			api: { limit: config.limits.apiRequests, windowSeconds: config.limits.apiWindowSeconds },
			share: { limit: 20, windowSeconds: 600 }
		})
	};

	const auth = createAuth({ config, db, queue: adapters.queue });
	const deps: Deps = { config, db, adapters, auth, logger };
	return {
		deps,
		redis,
		async close() {
			await Promise.allSettled(closers.map((c) => c()));
		}
	};
}

function buildMailer(config: Config): Mailer {
	switch (config.mailDriver) {
		case "smtp":
			return smtpMailer(required(config.mail.smtpUrl, "SMTP_URL"), config.mail.from);
		case "resend":
			return resendMailer(required(config.mail.resendApiKey, "RESEND_API_KEY"), config.mail.from);
		default:
			return noMailer();
	}
}
