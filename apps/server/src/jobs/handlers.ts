import { inArray } from "drizzle-orm";
import type { Blobs, Mailer } from "../adapters/types.ts";
import type { Db } from "../db/client.ts";
import { projectFile } from "../db/schema.ts";
import type { Logger } from "../lib/logger.ts";
import type { Job } from "./types.ts";

export interface JobDeps {
	db: Db;
	blobs: Blobs;
	mailer: Mailer;
	logger: Logger;
}

/** Idempotent by contract: every queue here is at-least-once. */
export async function runJob(job: Job, deps: JobDeps) {
	switch (job.type) {
		case "email.send":
			await deps.mailer.send(job.mail);
			return;
		case "blobs.delete": {
			// Only purge keys no row references, so a job that runs before (or without) the
			// delete committing can never destroy live data. Worst case is an orphan, not a loss.
			const live = await deps.db
				.select({ key: projectFile.blobKey })
				.from(projectFile)
				.where(inArray(projectFile.blobKey, job.keys));
			const referenced = new Set(live.map((r) => r.key));
			const orphans = job.keys.filter((k) => !referenced.has(k));
			if (orphans.length) await deps.blobs.delete(orphans);
			if (referenced.size) {
				deps.logger.info("blob purge skipped live keys", { skipped: referenced.size });
			}
			return;
		}
	}
}
