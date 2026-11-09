/** Postgres error code, whether thrown by postgres.js directly or wrapped by Drizzle. */
export function pgErrorCode(error: unknown): string | undefined {
	let current: unknown = error;
	for (let depth = 0; current && depth < 4; depth++) {
		const code = (current as { code?: unknown }).code;
		if (typeof code === "string") return code;
		current = (current as { cause?: unknown }).cause;
	}
	return undefined;
}

export const isUniqueViolation = (error: unknown) => pgErrorCode(error) === "23505";
