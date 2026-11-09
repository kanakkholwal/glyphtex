import { createPolicy } from "../../lib/resilience.ts";
import type { SendEmail } from "../cloudflare/bindings.ts";
import type { Mailer } from "../types.ts";
import { PermanentMailError } from "./errors.ts";

// Only these are worth another attempt; the rest (sender not verified, recipient not allowed, ...) never succeed.
const TRANSIENT = new Set([
	"E_RATE_LIMIT_EXCEEDED",
	"E_DELIVERY_FAILED",
	"E_INTERNAL_SERVER_ERROR"
]);
const codeOf = (error: unknown) => (error as { code?: unknown } | null)?.code;

/** "Name <a@b.c>" or a bare address, as the binding's object form wants it. */
export function parseSender(from: string): string | { email: string; name: string } {
	const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
	return match?.[2] ? { email: match[2], name: match[1] || match[2] } : from.trim();
}

/** Cloudflare Email Service through a Workers `send_email` binding. */
export function cloudflareMailer(binding: SendEmail, from: string): Mailer {
	const sender = parseSender(from);
	const policy = createPolicy("Email", {
		retry: { shouldRetry: (error) => TRANSIENT.has(String(codeOf(error))) }
	});
	return {
		async send({ to, subject, text, html }) {
			try {
				await policy.run(() => binding.send({ to, from: sender, subject, text, html }));
			} catch (error) {
				const code = codeOf(error);
				if (typeof code === "string" && code.startsWith("E_") && !TRANSIENT.has(code)) {
					throw new PermanentMailError(
						`Cloudflare refused the email (${code}): ${error instanceof Error ? error.message : ""}`,
						{ cause: error }
					);
				}
				throw error;
			}
		}
	};
}
