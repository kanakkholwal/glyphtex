import type { Mailer } from "../types.ts";

/** Used when no mail driver is configured: messages are dropped, and the sign-in screen hides what needs mail. */
export function noMailer(): Mailer {
	return {
		async send() {}
	};
}
