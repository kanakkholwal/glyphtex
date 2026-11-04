import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";
import { errors } from "../lib/errors.ts";

/** zod validation that fails with the same problem+json shape as every other error. */
export const validate = <T extends ZodType, K extends keyof ValidationTargets>(
	target: K,
	schema: T
) =>
	zValidator(target, schema, (result) => {
		if (!result.success) {
			throw errors.badRequest("Invalid request.", {
				issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
			});
		}
	});
