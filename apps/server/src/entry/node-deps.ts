import { smtpMailer } from "../adapters/mail/smtp.ts";
import { resendMailer } from "../adapters/mail/resend.ts";
import { connectRabbit, rabbitQueue } from "../adapters/rabbitmq/queue.ts";
import { connectRedis, redisCache, redisQueue, redisRateLimiter } from "../adapters/redis/index.ts";
import { s3Blobs } from "../adapters/s3/blobs.ts";
import type { Adapters, Mailer } from "../adapters/types.ts";
import { createAuth } from "../auth/auth.ts";
import { type Config, parseConfig, required } from "../config.ts";
import type { Deps } from "../context.ts";
import { connectDb } from "../db/client.ts";
import { createLogger } from "../lib/logger.ts";

/** Composition root for Node/Bun: one set of long-lived connections per process. */
export async function buildNodeDeps(env: Record<string, unknown> = process.env) {
	const config = parseConfig(env);
	const logger = createLogger({ runtime: "node" });
	const redis = connectRedis(required(config.redisUrl, "REDIS_URL"));
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

	const adapters: Adapters = {
		cache: redisCache(redis),
		queue,
		blobs: s3Blobs({
			endpoint: required(config.s3.endpoint, "S3_ENDPOINT"),
			region: config.s3.region,
			bucket: required(config.s3.bucket, "S3_BUCKET"),
			accessKeyId: required(config.s3.accessKeyId, "S3_ACCESS_KEY_ID"),
			secretAccessKey: required(config.s3.secretAccessKey, "S3_SECRET_ACCESS_KEY")
		}),
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
	return config.mailDriver === "smtp"
		? smtpMailer(required(config.mail.smtpUrl, "SMTP_URL"), config.mail.from)
		: resendMailer(required(config.mail.resendApiKey, "RESEND_API_KEY"), config.mail.from);
}
