type Level = "debug" | "info" | "warn" | "error";

export interface Logger {
	debug(msg: string, fields?: Record<string, unknown>): void;
	info(msg: string, fields?: Record<string, unknown>): void;
	warn(msg: string, fields?: Record<string, unknown>): void;
	error(msg: string, fields?: Record<string, unknown>): void;
	child(fields: Record<string, unknown>): Logger;
}

function serializeError(value: unknown) {
	return value instanceof Error
		? { name: value.name, message: value.message, stack: value.stack }
		: value;
}

/** One JSON line per event: readable by Workers Logs, Docker and any log shipper alike. */
export function createLogger(base: Record<string, unknown> = {}): Logger {
	const write = (level: Level, msg: string, fields: Record<string, unknown> = {}) => {
		const entry: Record<string, unknown> = { level, msg, time: new Date().toISOString(), ...base };
		for (const [k, v] of Object.entries(fields)) entry[k] = serializeError(v);
		(level === "error" ? console.error : level === "warn" ? console.warn : console.log)(
			JSON.stringify(entry)
		);
	};
	return {
		debug: (m, f) => write("debug", m, f),
		info: (m, f) => write("info", m, f),
		warn: (m, f) => write("warn", m, f),
		error: (m, f) => write("error", m, f),
		child: (fields) => createLogger({ ...base, ...fields })
	};
}
