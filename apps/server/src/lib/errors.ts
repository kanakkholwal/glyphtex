import type { ContentfulStatusCode } from "hono/utils/http-status";

/** An error that is safe to show to the client; anything else becomes a generic 500. */
export class AppError extends Error {
	readonly status: ContentfulStatusCode;
	readonly code: string;
	readonly detail?: Record<string, unknown>;

	constructor(
		status: ContentfulStatusCode,
		code: string,
		message: string,
		detail?: Record<string, unknown>
	) {
		super(message);
		this.name = "AppError";
		this.status = status;
		this.code = code;
		this.detail = detail;
	}
}

export const errors = {
	badRequest: (message: string, detail?: Record<string, unknown>) =>
		new AppError(400, "bad_request", message, detail),
	unauthorized: () => new AppError(401, "unauthorized", "Sign in to continue."),
	forbidden: (message = "You don't have permission to do that.") =>
		new AppError(403, "forbidden", message),
	storageDisabled: () =>
		new AppError(
			501,
			"storage_disabled",
			"This server doesn't store binary files such as images. Text files are saved as usual."
		),
	twoFactorRequired: () =>
		new AppError(
			403,
			"two_factor_required",
			"This organization requires two-factor authentication. Turn it on in Settings, then Account."
		),
	notFound: (what = "Resource") => new AppError(404, "not_found", `${what} not found.`),
	conflict: (message: string, detail?: Record<string, unknown>) =>
		new AppError(409, "conflict", message, detail),
	gone: (message: string) => new AppError(410, "gone", message),
	preconditionRequired: (message: string) => new AppError(428, "precondition_required", message),
	tooLarge: (message: string) => new AppError(413, "payload_too_large", message),
	tooManyRequests: (retryAfterSeconds: number) =>
		new AppError(429, "rate_limited", "Too many requests. Try again shortly.", {
			retryAfterSeconds
		}),
	unavailable: (service: string) =>
		new AppError(503, "service_unavailable", `${service} is temporarily unavailable.`)
};
