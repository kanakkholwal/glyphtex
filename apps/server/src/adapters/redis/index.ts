import { Redis } from "ioredis";
import { createPolicy } from "../../lib/resilience.ts";
import type { Job } from "../../jobs/types.ts";
import type { Cache, Queue, RateLimiter, RateLimitPolicy } from "../types.ts";

export const JOBS_KEY = "glyphtex:jobs";
export const DELAYED_KEY = "glyphtex:jobs:delayed";
export const DEAD_KEY = "glyphtex:jobs:dead";

export function connectRedis(url: string) {
	return new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false });
}

export function redisCache(redis: Redis): Cache {
	const policy = createPolicy("Cache", { timeoutMs: 2_000, retry: { attempts: 2 } });
	return {
		get: (key) => policy.run(() => redis.get(key)),
		async set(key, value, ttl) {
			await policy.run(() => (ttl ? redis.set(key, value, "EX", ttl) : redis.set(key, value)));
		},
		async delete(key) {
			await policy.run(() => redis.del(key));
		},
		async ping() {
			await policy.run(() => redis.ping());
		}
	};
}

export interface QueuedJob {
	job: Job;
	attempts: number;
}

/** Producer side; `node-jobs.ts` consumes. Delayed jobs sit in a sorted set until due. */
export function redisQueue(redis: Redis): Queue {
	const policy = createPolicy("Job queue", { timeoutMs: 3_000 });
	return {
		async enqueue(job, options) {
			const payload = JSON.stringify({ job, attempts: 0 } satisfies QueuedJob);
			await policy.run(() =>
				options?.delaySeconds
					? redis.zadd(DELAYED_KEY, Date.now() + options.delaySeconds * 1000, payload)
					: redis.lpush(JOBS_KEY, payload)
			);
		}
	};
}

/** Fixed-window counter; good enough for abuse protection, not for billing. */
export function redisRateLimiter(
	redis: Redis,
	policies: Record<RateLimitPolicy, { limit: number; windowSeconds: number }>
): RateLimiter {
	const policy = createPolicy("Rate limiter", { timeoutMs: 1_000, retry: { attempts: 1 } });
	return {
		async check(name, key) {
			const { limit, windowSeconds } = policies[name];
			const window = Math.floor(Date.now() / 1000 / windowSeconds);
			const redisKey = `glyphtex:rl:${name}:${key}:${window}`;
			const count = await policy.run(async () => {
				const [[, n] = [null, 0]] = (await redis
					.multi()
					.incr(redisKey)
					.expire(redisKey, windowSeconds)
					.exec()) as [Error | null, number][];
				return n;
			});
			const retryAfterSeconds = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
			return { allowed: count <= limit, retryAfterSeconds };
		}
	};
}
