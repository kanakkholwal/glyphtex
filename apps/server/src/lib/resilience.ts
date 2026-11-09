import { errors } from "./errors.ts";

export interface RetryOptions {
	attempts: number;
	baseDelayMs: number;
	maxDelayMs: number;
	shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_RETRY: RetryOptions = { attempts: 3, baseDelayMs: 100, maxDelayMs: 2000 };

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Exponential backoff with full jitter, so retrying clients don't stampede in lockstep. */
export function backoffDelay(attempt: number, base: number, max: number) {
	return Math.random() * Math.min(max, base * 2 ** attempt);
}

export async function retry<T>(fn: () => Promise<T>, options: Partial<RetryOptions> = {}) {
	const o = { ...DEFAULT_RETRY, ...options };
	let lastError: unknown;
	for (let attempt = 0; attempt < o.attempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (attempt === o.attempts - 1 || o.shouldRetry?.(error) === false) break;
			await sleep(backoffDelay(attempt, o.baseDelayMs, o.maxDelayMs));
		}
	}
	throw lastError;
}

export class TimeoutError extends Error {
	constructor(ms: number) {
		super(`Timed out after ${ms}ms`);
		this.name = "TimeoutError";
	}
}

/** Runs `fn` with an AbortSignal that fires after `ms`; the caller passes it to fetch etc. */
export async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>) {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			controller.abort();
			reject(new TimeoutError(ms));
		}, ms);
	});
	try {
		return await Promise.race([fn(controller.signal), timeout]);
	} finally {
		clearTimeout(timer);
	}
}

export class CircuitOpenError extends Error {
	constructor(name: string) {
		super(`Circuit "${name}" is open`);
		this.name = "CircuitOpenError";
	}
}

export interface BreakerOptions {
	failureThreshold: number;
	resetAfterMs: number;
	now?: () => number;
}

/**
 * Closed -> open after `failureThreshold` consecutive failures; half-open after `resetAfterMs`,
 * where one trial call decides. State is per instance (per isolate/process), by design.
 */
export class CircuitBreaker {
	private failures = 0;
	private openedAt: number | null = null;
	private trialInFlight = false;
	readonly name: string;
	private readonly options: Required<BreakerOptions>;

	constructor(name: string, options: Partial<BreakerOptions> = {}) {
		this.name = name;
		this.options = { failureThreshold: 5, resetAfterMs: 30_000, now: Date.now, ...options };
	}

	get state(): "closed" | "open" | "half-open" {
		if (this.openedAt === null) return "closed";
		return this.options.now() - this.openedAt >= this.options.resetAfterMs ? "half-open" : "open";
	}

	async run<T>(fn: () => Promise<T>): Promise<T> {
		const state = this.state;
		if (state === "open" || (state === "half-open" && this.trialInFlight)) {
			throw new CircuitOpenError(this.name);
		}
		const trial = state === "half-open";
		if (trial) this.trialInFlight = true;
		try {
			const result = await fn();
			this.failures = 0;
			this.openedAt = null;
			return result;
		} catch (error) {
			this.failures++;
			if (trial || this.failures >= this.options.failureThreshold) {
				this.openedAt = this.options.now();
			}
			throw error;
		} finally {
			if (trial) this.trialInFlight = false;
		}
	}
}

export interface ResilienceOptions {
	retry?: Partial<RetryOptions>;
	breaker?: Partial<BreakerOptions>;
	timeoutMs?: number;
}

/**
 * One policy per external dependency: breaker -> retry -> timeout per attempt.
 * An open breaker surfaces as a 503 so callers get a plain-language error.
 */
export function createPolicy(name: string, options: ResilienceOptions = {}) {
	const breaker = new CircuitBreaker(name, options.breaker);
	const timeoutMs = options.timeoutMs ?? 10_000;
	return {
		breaker,
		run<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
			return breaker
				.run(() => retry(() => withTimeout(timeoutMs, fn), options.retry))
				.catch((error: unknown) => {
					if (error instanceof CircuitOpenError) throw errors.unavailable(name);
					throw error;
				});
		}
	};
}

export type Policy = ReturnType<typeof createPolicy>;

/** Throws on a non-2xx response so the retry policy sees it; 4xx (except 429) is not retried. */
export class HttpError extends Error {
	readonly status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = "HttpError";
		this.status = status;
	}
}

export const retryableHttp = (error: unknown) =>
	!(error instanceof HttpError) || error.status === 429 || error.status >= 500;
