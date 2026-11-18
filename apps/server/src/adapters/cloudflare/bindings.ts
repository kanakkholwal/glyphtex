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

export interface SendEmail {
	send(message: {
		to: string;
		from: string | { email: string; name: string };
		subject: string;
		text: string;
		html: string;
	}): Promise<{ messageId: string }>;
}

export interface Hyperdrive {
	connectionString: string;
}

export interface ExecutionContext {
	waitUntil(promise: Promise<unknown>): void;
	passThroughOnException(): void;
}

export interface DurableObjectStub {
	fetch(request: Request): Promise<Response>;
}

export interface DurableObjectNamespace {
	idFromName(name: string): unknown;
	get(id: unknown): DurableObjectStub;
}

export interface DurableObjectState {
	storage: {
		get<T>(key: string): Promise<T | undefined>;
		put(key: string, value: unknown): Promise<void>;
	};
}

export interface WorkersWebSocket {
	accept(): void;
	send(data: Uint8Array): void;
	close(code?: number, reason?: string): void;
	addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
	addEventListener(type: "close" | "error", listener: () => void): void;
}

/** The Workers-only socket pair: `[0]` goes back to the browser, `[1]` stays in the object. */
export declare const WorkersWebSocketPair: new () => { 0: WorkersWebSocket; 1: WorkersWebSocket };

/** A 101 response that hands the client end of a socket pair to the browser. */
export const switchingProtocols = (client: WorkersWebSocket) =>
	new Response(null, { status: 101, webSocket: client } as ResponseInit);
