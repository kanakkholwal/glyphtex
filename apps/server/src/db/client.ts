import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "./schema.ts";

export interface DbOptions {
	max?: number;
	/** Hyperdrive pools upstream and caches type lookups itself. */
	viaHyperdrive?: boolean;
}

export function connectDb(url: string, options: DbOptions = {}) {
	const sql = postgres(url, {
		max: options.max ?? 10,
		prepare: !options.viaHyperdrive,
		fetch_types: !options.viaHyperdrive,
		connect_timeout: 10,
		idle_timeout: 20
	});
	return { db: drizzle(sql, { schema }), close: () => sql.end({ timeout: 5 }) };
}

export type Db = ReturnType<typeof connectDb>["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
