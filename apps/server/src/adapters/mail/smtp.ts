import nodemailer from "nodemailer";
import { createPolicy } from "../../lib/resilience.ts";
import type { Mailer } from "../types.ts";

/** Node only: SMTP needs raw TCP. */
export function smtpMailer(url: string, from: string): Mailer {
	const transport = nodemailer.createTransport(url);
	const policy = createPolicy("Email");
	return {
		async send(mail) {
			await policy.run(() => transport.sendMail({ from, ...mail }));
		}
	};
}
