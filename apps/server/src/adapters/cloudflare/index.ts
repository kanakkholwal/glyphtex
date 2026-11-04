import { createPolicy } from "../../lib/resilience.ts";
import type { Job } from "../../jobs/types.ts";
import type { Blobs, Cache, Queue, RateLimiter, RateLimitPolicy } from "../types.ts";
import type { KVNamespace, Queue as CfQueue, R2Bucket, RateLimit } from "./bindings.ts";

// KV rejects TTLs under 60s; shorter entries live up to a minute, which only extends a cache hit.
const KV_MIN_TTL = 60;

export function kvCache(kv: KVNamespace): Cache {
	const policy = createPolicy("Cache", { timeoutMs: 3_000, retry: { attempts: 2 } });
	return {
		get: (key) => policy.run(() => kv.get(key)),
		set: (key, value, ttl) =>
			policy.run(() =>
				kv.put(key, value, ttl ? { expirationTtl: Math.max(KV_MIN_TTL, ttl) } : undefined)
			),
		delete: (key) => policy.run(() => kv.delete(key)),
		async ping() {
			await policy.run(() => kv.get("glyphtex:ping"));
		}
	};
}

export function cfQueue(queue: CfQueue<Job>): Queue {
	const policy = createPolicy("Job queue", { timeoutMs: 5_000 });
	return {
		enqueue: (job, options) =>
			policy.run(() =>
				queue.send(job, options?.delaySeconds ? { delaySeconds: options.delaySeconds } : {})
			)
	};
}

export function r2Blobs(bucket: R2Bucket): Blobs {
	const policy = createPolicy("Blob storage", { timeoutMs: 30_000 });
	return {
		async put(key, data, contentType) {
			await policy.run(() =>
				bucket.put(key, data, contentType ? { httpMetadata: { contentType } } : undefined)
			);
		},
		async get(key) {
			const obj = await policy.run(() => bucket.get(key));
			if (!obj) return null;
			return { body: obj.body, size: obj.size, contentType: obj.httpMetadata?.contentType };
		},
		async delete(keys) {
			// R2 caps a bulk delete at 1000 keys.
			for (let i = 0; i < keys.length; i += 1000) {
				const batch = keys.slice(i, i + 1000);
				await policy.run(() => bucket.delete(batch));
			}
		}
	};
}

export function cfRateLimiter(bindings: Record<RateLimitPolicy, RateLimit>): RateLimiter {
	return {
		async check(policy, key) {
			const { success } = await bindings[policy].limit({ key });
			return { allowed: success, retryAfterSeconds: 60 };
		}
	};
}
