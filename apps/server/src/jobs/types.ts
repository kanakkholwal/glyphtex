import { z } from "zod";

export const jobSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("email.send"),
		mail: z.object({ to: z.email(), subject: z.string(), text: z.string(), html: z.string() })
	}),
	z.object({ type: z.literal("blobs.delete"), keys: z.array(z.string()).min(1) })
]);

export type Job = z.infer<typeof jobSchema>;

/** Queue payloads cross a process boundary, so they are re-validated on the way out. */
export const parseJob = (value: unknown): Job => jobSchema.parse(value);

export const MAX_JOB_ATTEMPTS = 8;
