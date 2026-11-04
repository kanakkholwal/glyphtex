import type { Job } from "../jobs/types.ts";

/** Key-value cache with TTL. Also backs Better Auth's secondary storage (sessions, rate limits). */
export interface Cache {
	get(key: string): Promise<string | null>;
	set(key: string, value: string, ttlSeconds?: number): Promise<void>;
	delete(key: string): Promise<void>;
	ping(): Promise<void>;
}

/** At-least-once background jobs; handlers must be idempotent. */
export interface Queue {
	enqueue(job: Job, options?: { delaySeconds?: number }): Promise<void>;
}

export interface BlobObject {
	body: ReadableStream<Uint8Array>;
	size: number;
	contentType: string | undefined;
}

export interface Blobs {
	put(key: string, data: Uint8Array, contentType?: string): Promise<void>;
	get(key: string): Promise<BlobObject | null>;
	delete(keys: string[]): Promise<void>;
}

export interface Mail {
	to: string;
	subject: string;
	text: string;
	html: string;
}

export interface Mailer {
	send(mail: Mail): Promise<void>;
}

export type RateLimitPolicy = "api" | "share";

export interface RateLimiter {
	check(
		policy: RateLimitPolicy,
		key: string
	): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

export interface Adapters {
	cache: Cache;
	queue: Queue;
	blobs: Blobs;
	mailer: Mailer;
	rateLimiter: RateLimiter;
}
