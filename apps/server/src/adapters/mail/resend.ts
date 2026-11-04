import { createPolicy, HttpError, retryableHttp } from "../../lib/resilience.ts";
import type { Mailer } from "../types.ts";

export function resendMailer(apiKey: string, from: string): Mailer {
	const policy = createPolicy("Email", { retry: { shouldRetry: retryableHttp } });
	return {
		async send(mail) {
			await policy.run(async (signal) => {
				const res = await fetch("https://api.resend.com/emails", {
					method: "POST",
					signal,
					headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
					body: JSON.stringify({ from, ...mail })
				});
				if (!res.ok)
					throw new HttpError(res.status, `Resend failed: ${res.status} ${await res.text()}`);
			});
		}
	};
}
