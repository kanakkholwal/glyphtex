// Structural subset of Workers types: the real globals clash with @types/node.
export interface KVNamespace {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
	delete(key: string): Promise<void>;
}

export interface R2ObjectBody {
	body: ReadableStream<Uint8Array>;
	size: number;
	httpMetadata?: { contentType?: string };
}

export interface R2Bucket {
	put(
		key: string,
		value: Uint8Array,
		options?: { httpMetadata?: { contentType?: string } }
	): Promise<unknown>;
	get(key: string): Promise<R2ObjectBody | null>;
	delete(keys: string | string[]): Promise<void>;
}

export interface Queue<T> {
	send(body: T, options?: { delaySeconds?: number }): Promise<void>;
}

export interface Message<T> {
	readonly id: string;
	readonly body: T;
	readonly attempts: number;
	ack(): void;
	retry(options?: { delaySeconds?: number }): void;
}

export interface MessageBatch<T> {
	readonly queue: string;
	readonly messages: readonly Message<T>[];
}

export interface RateLimit {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Hyperdrive {
	connectionString: string;
}

export interface ExecutionContext {
	waitUntil(promise: Promise<unknown>): void;
	passThroughOnException(): void;
}
