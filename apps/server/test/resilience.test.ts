import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AppError } from "../src/lib/errors.ts";
import {
	CircuitBreaker,
	CircuitOpenError,
	createPolicy,
	HttpError,
	retry,
	retryableHttp,
	TimeoutError,
	withTimeout
} from "../src/lib/resilience.ts";

const fail = () => Promise.reject(new Error("boom"));

describe("retry", () => {
	test("retries until success", async () => {
		let calls = 0;
		const result = await retry(
			async () => {
				if (++calls < 3) throw new Error("flaky");
				return "ok";
			},
			{ baseDelayMs: 1 }
		);
		assert.equal(result, "ok");
		assert.equal(calls, 3);
	});

	test("gives up after the attempt budget", async () => {
		let calls = 0;
		await assert.rejects(
			retry(
				() => {
					calls++;
					return fail();
				},
				{ attempts: 4, baseDelayMs: 1 }
			)
		);
		assert.equal(calls, 4);
	});

	test("does not retry client errors", async () => {
		let calls = 0;
		await assert.rejects(
			retry(
				async () => {
					calls++;
					throw new HttpError(400, "bad");
				},
				{ baseDelayMs: 1, shouldRetry: retryableHttp }
			)
		);
		assert.equal(calls, 1);
	});

	test("retries 429 and 5xx", () => {
		assert.equal(retryableHttp(new HttpError(429, "")), true);
		assert.equal(retryableHttp(new HttpError(503, "")), true);
		assert.equal(retryableHttp(new HttpError(404, "")), false);
	});
});

test("withTimeout aborts slow work", async () => {
	let aborted = false;
	await assert.rejects(
		withTimeout(20, (signal) => {
			signal.addEventListener("abort", () => {
				aborted = true;
			});
			return new Promise(() => {});
		}),
		TimeoutError
	);
	assert.equal(aborted, true);
});

describe("circuit breaker", () => {
	test("opens after the threshold and fails fast", async () => {
		const now = 0;
		const breaker = new CircuitBreaker("t", {
			failureThreshold: 2,
			resetAfterMs: 100,
			now: () => now
		});
		await assert.rejects(breaker.run(fail));
		await assert.rejects(breaker.run(fail));
		assert.equal(breaker.state, "open");
		let called = false;
		await assert.rejects(
			breaker.run(async () => {
				called = true;
			}),
			CircuitOpenError
		);
		assert.equal(called, false);
	});

	test("half-open trial closes on success and reopens on failure", async () => {
		let now = 0;
		const breaker = new CircuitBreaker("t", {
			failureThreshold: 1,
			resetAfterMs: 100,
			now: () => now
		});
		await assert.rejects(breaker.run(fail));
		now = 150;
		assert.equal(breaker.state, "half-open");
		await assert.rejects(breaker.run(fail));
		assert.equal(breaker.state, "open");
		now = 300;
		assert.equal(await breaker.run(async () => 1), 1);
		assert.equal(breaker.state, "closed");
	});

	test("a success resets the failure count", async () => {
		const breaker = new CircuitBreaker("t", { failureThreshold: 2 });
		await assert.rejects(breaker.run(fail));
		await breaker.run(async () => 1);
		await assert.rejects(breaker.run(fail));
		assert.equal(breaker.state, "closed");
	});
});

test("an open policy surfaces as a plain-language 503", async () => {
	const policy = createPolicy("Email", {
		breaker: { failureThreshold: 1 },
		retry: { attempts: 1 }
	});
	await assert.rejects(policy.run(fail));
	await assert.rejects(
		policy.run(async () => 1),
		(error: unknown) => {
			assert.ok(error instanceof AppError);
			assert.equal(error.status, 503);
			assert.match(error.message, /Email is temporarily unavailable/);
			return true;
		}
	);
});
